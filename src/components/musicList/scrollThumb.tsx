import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    SharedValue,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";
import { fontSizeConst } from "@/constants/uiConst";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";

interface ScrollThumbProps {
    /** 列表总集数 */
    total: number;
    /** 当前滚动进度 0-1（由外部 onScroll 与内部拖动共同维护） */
    progress: SharedValue<number>;
    /** 拖动到某进度时，通知外部滚动到对应项 */
    onDragProgress: (progress: number) => void;
    /** 拖动状态变化（供外部判断要不要忽略 onScroll 回写） */
    onDragStateChange: (dragging: boolean) => void;
}

const BAR_HIT_WIDTH = rpx(48);
const TRACK_WIDTH = rpx(6);
const THUMB_SIZE = rpx(18);

/**
 * Word 式右侧快捷滚动滑块。
 * 按住滑块上下拖动即可按比例跳到对应集数，拖动中显示“第 N / 总集”。
 */
export default function ScrollThumb(props: ScrollThumbProps) {
    const { total, progress, onDragProgress, onDragStateChange } = props;
    const colors = useColors();
    const barHeightSV = useSharedValue(0);
    const labelVisibleSV = useSharedValue(0);
    const [label, setLabel] = useState<number | null>(null);

    const notifyProgress = useCallback(
        (p: number) => {
            const clamped = Math.min(Math.max(p, 0), 1);
            progress.value = clamped;
            const index = Math.min(
                total - 1,
                Math.round(clamped * (total - 1)),
            );
            setLabel(index + 1);
            onDragProgress(clamped);
        },
        [progress, total, onDragProgress],
    );

    const gesture = Gesture.Pan()
        .onBegin(e => {
            "worklet";
            labelVisibleSV.value = 1;
            runOnJS(onDragStateChange)(true);
            const h = barHeightSV.value;
            if (h > 0) {
                runOnJS(notifyProgress)(e.y / h);
            }
        })
        .onUpdate(e => {
            "worklet";
            const h = barHeightSV.value;
            if (h > 0) {
                runOnJS(notifyProgress)(e.y / h);
            }
        })
        .onFinalize(() => {
            "worklet";
            labelVisibleSV.value = 0;
            runOnJS(onDragStateChange)(false);
            runOnJS(setLabel)(null);
        });

    const thumbStyle = useAnimatedStyle(() => {
        const maxTravel = Math.max(barHeightSV.value - THUMB_SIZE, 0);
        return {
            transform: [{ translateY: progress.value * maxTravel }],
        };
    });

    const labelStyle = useAnimatedStyle(() => {
        const maxTravel = Math.max(barHeightSV.value - THUMB_SIZE, 0);
        return {
            opacity: labelVisibleSV.value,
            transform: [
                { translateY: progress.value * maxTravel - rpx(6) },
            ],
        };
    });

    return (
        <View
            style={styles.wrapper}
            pointerEvents="box-none"
            onLayout={e => {
                barHeightSV.value = e.nativeEvent.layout.height;
            }}>
            <GestureDetector gesture={gesture}>
                <View style={styles.hitArea}>
                    <View
                        style={[
                            styles.track,
                            { backgroundColor: colors.text },
                        ]}
                    />
                    <Animated.View
                        style={[
                            styles.thumb,
                            { backgroundColor: colors.text },
                            thumbStyle,
                        ]}
                    />
                </View>
            </GestureDetector>
            <Animated.View
                style={[styles.label, labelStyle]}
                pointerEvents="none">
                <Text
                    style={[
                        styles.labelText,
                        { color: colors.text },
                    ]}>
                    {label ? `第 ${label} / ${total} 集` : ""}
                </Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: "absolute",
        top: 0,
        bottom: 0,
        right: 0,
        width: BAR_HIT_WIDTH,
        zIndex: 900,
    },
    hitArea: {
        width: BAR_HIT_WIDTH,
        height: "100%",
        alignItems: "center",
    },
    track: {
        width: TRACK_WIDTH,
        flex: 1,
        borderRadius: TRACK_WIDTH / 2,
        opacity: 0.28,
    },
    thumb: {
        position: "absolute",
        right: (BAR_HIT_WIDTH - THUMB_SIZE) / 2,
        top: 0,
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: THUMB_SIZE / 2,
        opacity: 0.85,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
    },
    label: {
        position: "absolute",
        right: BAR_HIT_WIDTH + rpx(4),
        top: 0,
        minWidth: rpx(150),
        paddingHorizontal: rpx(16),
        paddingVertical: rpx(8),
        borderRadius: rpx(10),
        backgroundColor: "rgba(0, 0, 0, 0.78)",
        alignItems: "center",
        justifyContent: "center",
    },
    labelText: {
        fontSize: fontSizeConst.description,
        includeFontPadding: false,
    },
});
