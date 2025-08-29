import { sys } from "cc";
import { EDITOR } from "cc/env";
import { GameSdk, MyDefine } from "../../data/MyDefine";
export class CDNManager {
// 可用CDN域名池（优先级从高到低）
    cdnPool = [
        "http://172.16.40.20:4002",
    ];
    private currentBundleURL = "";
    private remoteBundleName = "mainResources";
    private remoteBundleVersion = "";
    private isLocal = false;
        // 私有构造函数
    constructor(_remoteBundleName: string,_remoteBundleVersion: string,_isLocal: boolean = false) {
        this.remoteBundleName = _remoteBundleName;
        
        if(MyDefine.GameSdk === GameSdk.local_demo||EDITOR || sys.isBrowser){
            this.isLocal =true; // 本地包跳过remoteBundle
            return ;
        }
        this.isLocal = _isLocal;
        this.remoteBundleVersion = _remoteBundleVersion;
        const customPool = MyDefine.get("remotebundleCDNPool");
        if (Array.isArray(customPool) && customPool.length > 0) {
            console.log(customPool.toString())
            this.cdnPool = customPool;
        }
        const savedBundleName = sys.localStorage.getItem("savedBundleURL"+this.remoteBundleName);
        if (savedBundleName !== null) {
            const cleanedsavedBundleName = CDNManager.removeTrailingSlash(savedBundleName) ;
            this.currentBundleURL=cleanedsavedBundleName
        }else{
            this.currentBundleURL=this.getURL(0)
        }
    }


    // 解析带CDN域名的完整路径
    get resolveURL() {
        if(this.isLocal){ // 本地包跳过remoteBundle
            return `${this.resolveBundleName}`;
        }
        return this.currentBundleURL;
    }

    // bundle名称
    get resolveBundleName(){
        return this.remoteBundleName
    }

    // bundle版本
    get resolveBundleVersion(){
        if(this.isLocal){ // 本地包跳过remoteBundle
            return "";
        }
        return this.remoteBundleVersion
    }

    getURL(index: number){
        if(this.isLocal){  // 本地包跳过remoteBundle
            return `${this.resolveBundleName}`;
        }
        return `${this.cdnPool[index%(this.cdnPool.length)]}/${this.resolveBundleName}`;
    }

    get getMaxIndex(){
        return this.cdnPool.length;
    }

    static removeTrailingSlash(str: string): string {
        return str.replace(/\/+$/, '');
    }
}