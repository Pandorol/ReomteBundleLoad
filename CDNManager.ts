import { sys } from "cc";
import { MyDefine } from "../../data/MyDefine";
export class CDNManager {
// 可用CDN域名池（优先级从高到低）
    cdnPool = [
        "http://172.16.40.20:4002",
        "http://172.16.40.20:4001",
        "http://172.16.40.20:4000"
    ];
    private currentBundleURL = "";
    private remoteBundleName = "remotemain";
    private remoteBundleVersion = "";
        // 私有构造函数
    constructor(_remoteBundleName: string,_remoteBundleVersion: string) {
        this.remoteBundleName = _remoteBundleName;
        this.remoteBundleVersion = _remoteBundleVersion;
        const customPool = MyDefine.get("remotebundleCDNPool");
        console.log("====")
        if (Array.isArray(customPool) && customPool.length > 0) {
            console.log(customPool.toString())
            this.cdnPool = customPool;
        }
        const savedBundleName = sys.localStorage.getItem("savedBundleURL"+this.remoteBundleName);
        if (savedBundleName !== null) {
            const cleanedsavedBundleName =CDNManager.removeTrailingSlash(savedBundleName) ;
            this.currentBundleURL=cleanedsavedBundleName
        }else{
            this.currentBundleURL=this.getURL(0)
        }
    }


    // 解析带CDN域名的完整路径
    resolveURL() {
        return this.currentBundleURL;
    }
    resolveBundleName(){
        return this.remoteBundleName
    }
    resolveBundleVersion(){
        return this.remoteBundleVersion
    }
    getURL(index){
        return `${this.cdnPool[index%(this.cdnPool.length)]}/remote/${this.resolveBundleName()}`;
    }
    getMaxIndex(){
        return this.cdnPool.length;
    }

    static removeTrailingSlash(str: string): string {
        return str.replace(/\/+$/, '');
    }
}