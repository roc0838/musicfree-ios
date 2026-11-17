import { fileAsyncTransport, logger } from "react-native-logs";
import RNFS, { readDir, readFile } from "react-native-fs";
import pathConst from "@/constants/pathConst";
import Config from "../core/appConfig.ts";
import { addLog } from "@/lib/react-native-vdebug/src/log";

const config = {
    transport: fileAsyncTransport,
    transportOptions: {
        FS: RNFS,
        filePath: pathConst.logPath,
        fileName: "error-log-{date-today}.log",
    },
    dateFormat: "local",
};

const traceConfig = {
    transport: fileAsyncTransport,
    transportOptions: {
        FS: RNFS,
        filePath: pathConst.logPath,
        fileName: "trace-log.log",
    },
    dateFormat: "local",
};

const log = logger.createLogger(config);
const traceLogger = logger.createLogger(traceConfig);

export function trace(
    desc: string,
    message?: any,
    level: "info" | "error" = "info",
) {
    if (__DEV__) {
        console.log(desc, message);
    }
    // 特殊情况记录操作路径
    if (Config.getConfig("debug.traceLog")) {
        traceLogger[level]({
            desc,
            message,
        });
    }
}

export async function clearLog() {
    const files = await RNFS.readDir(pathConst.logPath);
    await Promise.all(
        files.map(async file => {
            if (file.isFile()) {
                try {
                    await RNFS.unlink(file.path);
                } catch {}
            }
        }),
    );
}

export async function getErrorLogContent() {
    try {
        const files = await readDir(pathConst.logPath);
        console.log(files);
        const today = new Date();
        // 两天的错误日志
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const todayLog = files.find(
            _ =>
                _.isFile() &&
                _.path.endsWith(
                    `error-log-${today.getDate()}-${
                        today.getMonth() + 1
                    }-${today.getFullYear()}.log`,
                ),
        );
        const yesterdayLog = files.find(
            _ =>
                _.isFile() &&
                _.path.endsWith(
                    `error-log-${yesterday.getDate()}-${
                        yesterday.getMonth() + 1
                    }-${yesterday.getFullYear()}.log`,
                ),
        );
        let logContent = "";
        if (todayLog) {
            logContent += await readFile(todayLog.path, "utf8");
        }
        if (yesterdayLog) {
            logContent += await readFile(yesterdayLog.path, "utf8");
        }
        return logContent;
    } catch {
        return "";
    }
}

export function errorLog(desc: string, message: any) {
    if (Config.getConfig("debug.errorLog")) {
        log.error({
            desc,
            message,
        });
        trace(desc, message, "error");
    }
}

/**
 * 诊断日志：不受调试开关限制，始终写入 trace-log.log，
 * 用于记录 seek / 续播等关键操作，方便从设置页导出后定位问题。
 */
export function diagLog(desc: string, message?: any) {
    try {
        traceLogger.info({
            desc,
            message,
            ts: Date.now(),
        });
    } catch { }
}

export function devLog(
    method: "log" | "error" | "warn" | "info",
    ...args: any[]
) {
    if (Config.getConfig("debug.devLog")) {
        addLog(method, args);
    }
}

/**
 * 汇总全部日志文件（错误日志 + 诊断日志），拼成一份文本供导出。
 * 不依赖调试开关，始终把 trace-log 一并带上。
 */
export async function collectAllLogs(): Promise<string> {
    try {
        const files = await RNFS.readDir(pathConst.logPath);
        const logFiles = files
            .filter(f => f.isFile() && /\.log$/i.test(f.name))
            .sort((a, b) => (a.name < b.name ? 1 : -1));
        const header = [
            "===== MusicFree iOS 日志导出 =====",
            `导出时间: ${new Date().toLocaleString()}`,
            `日志文件数: ${logFiles.length}`,
            "",
        ].join("\n");
        const parts: string[] = [];
        for (const file of logFiles) {
            try {
                const content = await RNFS.readFile(file.path, "utf8");
                parts.push(`----- ${file.name} -----\n${content}`);
            } catch { }
        }
        return header + (parts.join("\n\n") || "(暂无日志内容)");
    } catch {
        return "(读取日志失败)";
    }
}

export { log };
