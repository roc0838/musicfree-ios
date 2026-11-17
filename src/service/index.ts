import Config from "@/core/appConfig";
import RNTrackPlayer, { Event, State } from "react-native-track-player";
import TrackPlayer from "@/core/trackPlayer";
import { musicIsPaused } from "@/utils/trackUtils";
import PersistStatus from "@/utils/persistStatus";
import { patchMediaExtra } from "@/utils/mediaExtra";

let resumeState: State | null;
/** 听书断点续播：上一次写入的进度，用于节流，避免频繁写 MMKV */
let lastSavedProgress = -1;
const PROGRESS_SAVE_THRESHOLD = 3; // 秒
module.exports = async function () {
    RNTrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
    RNTrackPlayer.addEventListener(Event.RemotePause, () =>
        TrackPlayer.pause(),
    );
    RNTrackPlayer.addEventListener(Event.RemotePrevious, () =>
        TrackPlayer.skipToPrevious(),
    );
    RNTrackPlayer.addEventListener(Event.RemoteNext, () =>
        TrackPlayer.skipToNext(),
    );
    RNTrackPlayer.addEventListener(
        Event.RemoteDuck,
        async ({ paused, permanent }) => {
            if (Config.getConfig("basic.notInterrupt")) {
                return;
            }
            if (permanent) {
                return TrackPlayer.pause();
            }
            const tempRemoteDuckConf = Config.getConfig(
                "basic.tempRemoteDuck",
            );
            if (tempRemoteDuckConf === "lowerVolume") {
                if (paused) {
                    const tempRemoteDuckVolume = Config.getConfig(
                        "basic.tempRemoteDuckVolume",
                    ) ?? 0.5;
                    return RNTrackPlayer.setVolume(1 - tempRemoteDuckVolume);
                } else {
                    return RNTrackPlayer.setVolume(1);
                }
            } else {
                if (paused) {
                    resumeState =
                        (await RNTrackPlayer.getPlaybackState()).state ??
                        State.Paused;
                    return TrackPlayer.pause();
                } else {
                    if (resumeState && !musicIsPaused(resumeState)) {
                        resumeState = null;
                        return TrackPlayer.play();
                    }
                    resumeState = null;
                }
            }
        },
    );


    RNTrackPlayer.addEventListener(Event.PlaybackProgressUpdated, evt => {
        // 全局进度：用于 App 重启后恢复上一次播放位置（保持原行为）
        PersistStatus.set("music.progress", evt.position);

        // 听书/播客：按曲目分别记录进度，实现每一集独立断点续播。
        // 关闭开关时不写入，尊重用户选择。
        const current = TrackPlayer.currentMusic;
        if (
            Config.getConfig("basic.perMusicProgress") !== false &&
            current
        ) {
            const position = Math.floor(evt.position ?? 0);
            const duration = Math.floor(evt.duration ?? 0);
            // 播放到结尾附近视为已听完，清除该集进度，下次从头播放
            const finished = duration > 0 && position >= duration - 3;
            const value = finished ? 0 : position;
            // finished 时强制写入（不受节流影响），确保进度被清除
            if (
                finished ||
                Math.abs(value - lastSavedProgress) >= PROGRESS_SAVE_THRESHOLD
            ) {
                patchMediaExtra(current, { progress: value });
                lastSavedProgress = value;
            }
        }
    });

    // 切歌时重置节流基准，确保新的一集能立刻写入自己的进度
    RNTrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, () => {
        lastSavedProgress = -1;
    });

    RNTrackPlayer.addEventListener(Event.RemoteStop, async () => {
        RNTrackPlayer.stop();
    });

    RNTrackPlayer.addEventListener(Event.RemoteSeek, async evt => {
        TrackPlayer.seekTo(evt.position);
    });
};
