import axios from "axios";
import { compare } from "compare-versions";
import DeviceInfo from "react-native-device-info";

// 自签分发版本：不使用原作者的更新源，避免把用户导向不匹配的安卓/上游版本。
// 如需启用自动更新，把自建的可公开访问 version.json 地址填入此数组。
const updateList: string[] = [
    // "https://your-domain.example/musicfree-ios/release/version.json",
];

interface IUpdateInfo {
    needUpdate: boolean;
    data: {
        version: string;
        changeLog: string[];
        download: string[];
    };
}

export default async function checkUpdate(): Promise<IUpdateInfo | undefined> {
    const currentVersion = DeviceInfo.getVersion();
    for (let i = 0; i < updateList.length; ++i) {
        try {
            const rawInfo = (await axios.get(updateList[i])).data;
            if (compare(rawInfo.version, currentVersion, ">")) {
                return {
                    needUpdate: true,
                    data: rawInfo,
                };
            }
        } catch {}
    }
}
