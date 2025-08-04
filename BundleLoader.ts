import { Asset, AssetManager, assetManager, error, js, resources, __private } from "cc";
import { sys } from "cc";
import { CDNManager } from "./CDNManager";

type AssetType<T = any> = __private._types_globals__Constructor<T> | null;
type ProgressCallback = (finished: number, total: number, item: any) => void | null;
type CompleteCallback<T = any> = (err: Error | null, data: T) => void

interface ILoadResArgs<T extends Asset> {
    bundle?: string;
    dir?: string;
    paths: string | string[];
    type: AssetType<T> | null;
    onProgress: ProgressCallback | null;
    onComplete: CompleteCallback | null;
}
type LoadFunction = (
    bundle: AssetManager.Bundle,
    onProgress: ((finished: number, total: number, item: AssetManager.RequestItem) => void) | null,
    onComplete: ((err: Error | null, data: any | any[] | null) => void)| null
) => void;

export class BundleLoader {
    private defaultBundleName: string ="remotemain"
    private bundleVersion: string = "";
    private cdnManager: CDNManager;
    
    constructor(_bundleName: string= "remotemain",_bundleVersion: string = "") {
        this.defaultBundleName = _bundleName;
        this.bundleVersion = _bundleVersion;
        this.cdnManager = new CDNManager(this.defaultBundleName,this.bundleVersion);
    }
    
    public static shouldRetryCDN(err: Error): boolean {
        const msg = (err?.message || err?.toString() || '').toLowerCase();;
        console.log("shouldRetryCDN(err: Error) msg="+msg)
        
        // 典型需要重试的网络类错误
        if (
            msg.includes('failed to connect')//连不上，已知道的会报错的信息
        ) {
            return true;
        }
        if (
            //不需要切换重连，因为不是网络的问题是bundle上没有这个资源等的问题
            msg.includes("doesn't contain")  // 资源未包含，已知道的会报错的信息

        ) {
            return false;
        }

        // 默认重试
        return true;
    }
    private loadWithCDNRetry(
            initialBundle: AssetManager.Bundle,
            loadFunc: LoadFunction,
            onComplete?: ((err: Error | null, data: any | any[] | null) => void)| null,
            onProgress?: ((finished: number, total: number, item: AssetManager.RequestItem) => void) | null
        ): void {
        const self = this;
        let called = false;
        const safeOnComplete = (err: Error | null, data: any | any[] | null) => {
            if (!called && onComplete) {
                called = true;
                onComplete(err, data);
            }
        };



        
        const maxIndex = self.cdnManager.getMaxIndex();

        const untestedURLs: string[] = [];
        for (let i = 0; i < maxIndex; i++) {
            untestedURLs.push(self.cdnManager.getURL(i));
        }

        const tryLoad = (tryBundle: AssetManager.Bundle) => {
            loadFunc(tryBundle, onProgress ?? null, (err, data) => {
                if (err) {
                    console.warn(`资源加载失败 [${tryBundle.base}]，切换 CDN 重试....`, err.message);

                    const idx = untestedURLs.indexOf(CDNManager.removeTrailingSlash(tryBundle.base));
                    if (idx !== -1) untestedURLs.splice(idx, 1);

                    if (!BundleLoader.shouldRetryCDN(err)) {
                        console.warn(`不需要重试 CDN，直接返回错误`, err.message);
                        safeOnComplete(err, null);
                        return;
                    }

                    tryNextCDN();
                } else {
                    safeOnComplete(null, data);
                }
            });
        };

        const tryNextCDN = () => {
            if (untestedURLs.length === 0) {
                safeOnComplete(new Error('所有 CDN 尝试失败'), null);
                return;
            }

            const existingBundle = assetManager.bundles.get(self.defaultBundleName);
            const cleanedbase = existingBundle ? CDNManager.removeTrailingSlash(existingBundle.base):"";
            if (existingBundle && untestedURLs.includes(cleanedbase)) {
                console.info(`正在尝试加载 bundle，existingBundle URL: ${cleanedbase}`);
                tryLoad(existingBundle);
                return;
            }

            if (existingBundle) {
                assetManager.bundles.remove(self.defaultBundleName);
            }

            const nextURL = untestedURLs.shift()!;
            if (!nextURL) {
                safeOnComplete(new Error('所有 CDN 尝试失败'), null);
                return;
            }
            console.info(`正在尝试加载 bundle，nextURL: ${nextURL}`);
            self.loadOneBundle(nextURL, undefined, (err, newBundle) => {
                if (err) {
                    tryNextCDN();
                } else {
                    tryLoad(newBundle);
                }
            });
        };

        tryLoad(initialBundle);
    }
    public bundleLoad(
        bundle: AssetManager.Bundle,
        paths: string,
        type: __private._types_globals__Constructor<any>,
        onProgress: ((finished: number, total: number, item: AssetManager.RequestItem) => void) | null,
        onComplete: ((err: Error | null, data:any | null) => void)| null
    ): void;

    public bundleLoad(
        bundle: AssetManager.Bundle,
        paths: string[],
        type: __private._types_globals__Constructor<any>,
        onProgress: ((finished: number, total: number, item: AssetManager.RequestItem) => void) | null,
        onComplete: ((err: Error | null, data: any[] | null) => void)| null
    ): void;
    public bundleLoad(
        bundle:AssetManager.Bundle,
        paths: string | string[], 
        type: __private._types_globals__Constructor<any>,
        onProgress: ((finished: number, total: number, item: AssetManager.RequestItem) => void) | null,
        onComplete: ((err: Error | null, data: any | any[] | null) => void)| null){

        console.log("bundleLoad")        
        
        this.loadWithCDNRetry(
            bundle,
            (b, p, cb) => b.load(paths as any, type, p, cb),
            onComplete,
            onProgress
        );
    }
    public bundleLoadDir(
        bundle:AssetManager.Bundle,
        dir: string, 
        type: __private._types_globals__Constructor<any>,
        onProgress: ((finished: number, total: number, item: AssetManager.RequestItem) => void) | null, 
        onComplete: ((err: Error | null, data: any[] | null) => void)| null): void {

            console.log("bundleLoadDir")    
            this.loadWithCDNRetry(
                bundle,
                (b, p, cb) => b.loadDir(dir, type, p, cb),
                onComplete,
                onProgress
            );
    }


    public loadOneBundle(bundleName?: string,
        v?: string ,
        onComplete?: (err: Error | null, bundle?: AssetManager.Bundle) => void) {
        console.log("loadOneBundle bundleName="+bundleName)
        if(!bundleName) bundleName = this.cdnManager.resolveURL()
        if(!v) v = this.cdnManager.resolveBundleVersion()
        
        // 步骤3：加载Bundle
        return new Promise<AssetManager.Bundle>((resolve, reject) => {
            const tryLoad = (name: string) =>{
                assetManager.loadBundle(name, { version: v}, (err, bundle) => {
                    if (err) {
                        console.warn(name+`CDN尝试切换失败`, err);
                        console.log("loadOneBundle_reject")
                        onComplete?.(err);
                    } else {

                        sys.localStorage.setItem("savedBundleURL"+this.defaultBundleName,CDNManager.removeTrailingSlash(bundle.base));
                        // 注入当前CDN信息到bundle实例
                        console.warn(name+`loadSmartBundle CDN加载成功bundle.base=`+bundle.base+bundle.name);
                        onComplete?.(err,bundle);
                        resolve(bundle);
                    }
                });
            }
            tryLoad(bundleName);
        });
    }
    public loadSmartBundle(bundleName?: string,
        v?: string ,
        onComplete?: (err: Error | null, bundle?: AssetManager.Bundle) => void) {
        const self = this;
        if(!bundleName) bundleName = self.cdnManager.resolveURL()
        if(!v) v = self.cdnManager.resolveBundleVersion()


        
        const maxIndex = self.cdnManager.getMaxIndex();

        const untestedURLs: string[] = [];
        for (let i = 0; i < maxIndex; i++) {
            untestedURLs.push(self.cdnManager.getURL(i));
        }

        // 步骤3：加载Bundle
        return new Promise<AssetManager.Bundle>((resolve, reject) => {
            const tryLoad = (name: string) =>{
                assetManager.loadBundle(name, { version: v}, (err, bundle) => {
                    if (err) {

                        console.warn(name+`CDN加载失败，尝试切换`, err);

                        const idx = untestedURLs.indexOf(CDNManager.removeTrailingSlash(name));
                        if (idx !== -1) untestedURLs.splice(idx, 1);

                        if (untestedURLs.length > 0) {
                            let nextBundleName = untestedURLs.shift()!;
                            console.log("nextBundleName="+nextBundleName+",curname="+name);
                            
                            tryLoad(nextBundleName);
                        } else {
                            //reject(err);
                            console.log("loadSmartBundle_reject")
                            onComplete?.(err);
                        }
                    } else {
                        sys.localStorage.setItem("savedBundleURL"+this.defaultBundleName,CDNManager.removeTrailingSlash(bundle.base));
                        // 注入当前CDN信息到bundle实例
                        console.warn(name+`loadSmartBundle CDN加载成功bundle.base=`+bundle.base);
                        onComplete?.(err,bundle);
                        resolve(bundle);
                    }
                });
            }
            tryLoad(bundleName);
        });
    }

       /**
     * 加载一个资源
     * @param bundleName    远程包名
     * @param paths         资源路径
     * @param type          资源类型
     * @param onProgress    加载进度回调
     * @param onComplete    加载完成回调
     * @example
    ResLoader.load("spine_path", sp.SkeletonData, (err: Error | null, sd: sp.SkeletonData) => {
    
    });
     */
    public load<T extends Asset>(bundleName: string, paths: string | string[], type: AssetType<T> | null, onProgress: ProgressCallback | null, onComplete: CompleteCallback<T> | null): void;
    public load<T extends Asset>(bundleName: string, paths: string | string[], onProgress: ProgressCallback | null, onComplete: CompleteCallback<T> | null): void;
    public load<T extends Asset>(bundleName: string, paths: string | string[], onComplete?: CompleteCallback<T> | null): void;
    public load<T extends Asset>(bundleName: string, paths: string | string[], type: AssetType<T> | null, onComplete?: CompleteCallback<T> | null): void;
    public load<T extends Asset>(paths: string | string[], type: AssetType<T> | null, onProgress: ProgressCallback | null, onComplete: CompleteCallback<T> | null): void;
    public load<T extends Asset>(paths: string | string[], onProgress: ProgressCallback | null, onComplete: CompleteCallback<T> | null): void;
    public load<T extends Asset>(paths: string | string[], onComplete?: CompleteCallback<T> | null): void;
    public load<T extends Asset>(paths: string | string[], type: AssetType<T> | null, onComplete?: CompleteCallback<T> | null): void;
    public load<T extends Asset>(
        bundleName: string,
        paths?: string | string[] | AssetType<T> | ProgressCallback | CompleteCallback | null,
        type?: AssetType<T> | ProgressCallback | CompleteCallback | null,
        onProgress?: ProgressCallback | CompleteCallback | null,
        onComplete?: CompleteCallback | null,
    ) {
        let args: ILoadResArgs<T> | null = null;
        if (typeof paths === "string" || paths instanceof Array) {
            //args = this.parseLoadResArgs(paths, type, onProgress, onComplete);
            args.bundle = bundleName;
        }
        else {
            args = this.parseLoadResArgs(bundleName, paths, type, onProgress);
            args.bundle = this.defaultBundleName;
        }
        this.loadByArgs(args);
    }
    public loadAsync(
        bundleName: string,
        paths?: any,//string | string[] | AssetType<T> | ProgressCallback | CompleteCallback | null,
        type?: any//AssetType<T> | ProgressCallback | CompleteCallback | null,
    ) {
        return new Promise((resolve, reject) => {
            this.load(bundleName, paths, type, (err: Error | null, asset: Asset) => {
                if (err) {
                    error(err.message);
                }
                resolve(asset)
            });
        });
    }
    /**
      * 加载文件夹中的资源
      * @param bundleName    远程包名
      * @param dir           文件夹名
      * @param type          资源类型
      * @param onProgress    加载进度回调
      * @param onComplete    加载完成回调
      * @example
    // 加载进度事件
    var onProgressCallback = (finished: number, total: number, item: any) => {
     console.log("资源加载进度", finished, total);
    }
    
    // 加载完成事件
    var onCompleteCallback = () => {
     console.log("资源加载完成");
    }
    ResLoader.loadDir("game", onProgressCallback, onCompleteCallback);
      */
    public loadDir<T extends Asset>(bundleName: string, dir: string, type: AssetType<T> | null, onProgress: ProgressCallback | null, onComplete: CompleteCallback<T[]> | null): void;
    public loadDir<T extends Asset>(bundleName: string, dir: string, onProgress: ProgressCallback | null, onComplete: CompleteCallback<T[]> | null): void;
    public loadDir<T extends Asset>(bundleName: string, dir: string, onComplete?: CompleteCallback<T[]> | null): void;
    public loadDir<T extends Asset>(bundleName: string, dir: string, type: AssetType<T> | null, onComplete?: CompleteCallback<T[]> | null): void;
    public loadDir<T extends Asset>(dir: string, type: AssetType<T> | null, onProgress: ProgressCallback | null, onComplete: CompleteCallback<T[]> | null): void;
    public loadDir<T extends Asset>(dir: string, onProgress: ProgressCallback | null, onComplete: CompleteCallback<T[]> | null): void;
    public loadDir<T extends Asset>(dir: string, onComplete?: CompleteCallback<T[]> | null): void;
    public loadDir<T extends Asset>(dir: string, type: AssetType<T> | null, onComplete?: CompleteCallback<T[]> | null): void;
    public loadDir<T extends Asset>(
        bundleName: string,
        dir?: string | AssetType<T> | ProgressCallback | CompleteCallback | null,
        type?: AssetType<T> | ProgressCallback | CompleteCallback | null,
        onProgress?: ProgressCallback | CompleteCallback | null,
        onComplete?: CompleteCallback | null,
    ) {
        let args: ILoadResArgs<T> | null = null;
        if (typeof dir === "string") {
            args = this.parseLoadResArgs(dir, type, onProgress, onComplete);
            args.bundle = bundleName;
        }
        else {
            args = this.parseLoadResArgs(bundleName, dir, type, onProgress);
            args.bundle = this.defaultBundleName;
        }
        args.dir = args.paths as string;
        this.loadByArgs(args);
    }
    private parseLoadResArgs<T extends Asset>(
        paths: string | string[],
        type?: AssetType<T> | ProgressCallback | CompleteCallback | null,
        onProgress?: AssetType<T> | ProgressCallback | CompleteCallback | null,
        onComplete?: ProgressCallback | CompleteCallback | null
    ) {
        let pathsOut: any = paths;
        let typeOut: any = type;
        let onProgressOut: any = onProgress;
        let onCompleteOut: any = onComplete;
        if (onComplete === undefined) {
            const isValidType = js.isChildClassOf(type as AssetType, Asset);
            if (onProgress) {
                onCompleteOut = onProgress as CompleteCallback;
                if (isValidType) {
                    onProgressOut = null;
                }
            }
            else if (onProgress === undefined && !isValidType) {
                onCompleteOut = type as CompleteCallback;
                onProgressOut = null;
                typeOut = null;
            }
            if (onProgress !== undefined && !isValidType) {
                onProgressOut = type as ProgressCallback;
                typeOut = null;
            }
        }
        return { paths: pathsOut, type: typeOut, onProgress: onProgressOut, onComplete: onCompleteOut };
    }

    private loadByBundleAndArgs<T extends Asset>(bundle: AssetManager.Bundle, args: ILoadResArgs<T>): void {
                
        console.log(`loadByBundleAndArgs`);
        if (args.dir) {
            this.bundleLoadDir(bundle,args.paths as string, args.type, args.onProgress, args.onComplete);
        }
        else {
            let paths:any
            // if(args.paths.length){
            //     paths = args.paths
            // }else{
            //     paths = [args.paths]
            // }
            if(typeof args.paths == 'string'){
                paths = [args.paths]
            }else{
                paths = args.paths
            }
            
            if (typeof args.paths == 'string') {
                this.bundleLoad(bundle,args.paths, args.type, args.onProgress, args.onComplete);
            }
            else {
                this.bundleLoad(bundle,args.paths, args.type, args.onProgress, args.onComplete);
            }
            
        }
    }

    private loadByArgs<T extends Asset>(args: ILoadResArgs<T>) {

        // -- 
        if (args.bundle) {
            if (assetManager.bundles.has(args.bundle)) {
                let bundle = assetManager.getBundle(args.bundle);
                this.loadByBundleAndArgs(bundle!, args);
            }
            else {
                console.log("ResLoader.loadSmartBundl")
                //自动加载远程包
                this.loadSmartBundle(args.bundle,undefined,(err, bundle) => {
                    if (!err) {
                        this.loadByBundleAndArgs(bundle, args);
                    }
                })

            }
        }
        else {
            console.log("this.loadByBundleAndArgs(resources, args);")
            this.loadByBundleAndArgs(resources, args);
        }
    }


    public static loadRemote<T extends Asset>(url: string, options: any, onComplete?: (err: Error, data: T) => void): void;
    public static loadRemote<T extends Asset>(url: string, onComplete?: (err: Error, data: T) => void): void;
    public static loadRemote<T extends Asset>(url: string, ...args: any): void {
        var options: any | null = null;
        var onComplete: (err: Error, data: T) => void = null;
        if (args.length == 2) {
            options = args[0];
            onComplete = args[1];
        }
        else {
            onComplete = args[0];
        }
        assetManager.loadRemote<T>(url, options, onComplete);
    }
    /**
    * 通过资源相对路径释放资源
    * @param path          资源路径
    * @param bundleName    远程资源包名
    */
    public release(path: string, bundleName?: string) {
        if (bundleName == null) bundleName = this.defaultBundleName;
        var bundle = assetManager.getBundle(bundleName);
        if (bundle) {
            var asset = bundle.get(path);
            if (asset) {
                assetManager.releaseAsset(asset);
                /*if(sys.isNative) {
                    this.releasePrefabtDepsRecursively(asset._uuid);
                } else {
                    this.releasePrefabtDepsRecursively(asset.uuid);
                }*/
            }
        }
    }

    /**
     * 通过相对文件夹路径删除所有文件夹中资源
     * @param path          资源文件夹路径
     * @param bundleName    远程资源包名
     */
    public releaseDir(path: string, bundleName?: string) {
        if (bundleName == null) bundleName = this.defaultBundleName;

        var bundle: AssetManager.Bundle | null = assetManager.getBundle(bundleName);
        if (bundle) {
            var infos = bundle.getDirWithPath(path);
            if (infos) {
                infos.map((info) => {
                    this.releasePrefabtDepsRecursively(info.uuid);
                });
            }

            if (path == "" && bundleName != "resources") {
                assetManager.removeBundle(bundle);
            }
        }
    }


    /** 释放预制依赖资源 */
    private releasePrefabtDepsRecursively(uuid: string) {
        var asset = assetManager.assets.get(uuid);
        assetManager.releaseAsset(asset);

        // Cocos引擎内部已处理子关联资源的释放
        // if (asset instanceof Prefab) {
        //     var uuids: string[] = assetManager.dependUtil.getDepsRecursively(uuid)!;
        //     uuids.forEach(uuid => {
        //         var asset = assetManager.assets.get(uuid)!;
        //         asset.decRef();
        //     });
        // }
    }
    /**
     * 获取资源
     * @param path          资源路径
     * @param type          资源类型
     * @param bundleName    远程资源包名
     */
    public get<T extends Asset>(path: string, type?: __private._types_globals__Constructor<T> | null, bundleName?: string): T | null {
        if (bundleName == null) bundleName = this.defaultBundleName;

        var bundle: AssetManager.Bundle = assetManager.getBundle(bundleName)!;
        return bundle.get(path, type);
    }

    /** 打印缓存中所有资源信息 */
    public dump(str?: string) {
        // assetManager.assets.forEach((value: Asset, key: string) => {
        //     //console.log(assetManager.assets.get(key));
        // })
        // let count = []
        // assetManager.assets.forEach((value: Asset, key: string) => {
        //     if (!count[value.constructor.name]) {
        //         count[value.constructor.name] = []
        //     }
        //     count[value.constructor.name].push(key)
        // });
        // str = str || '当前资源总数:';
        // console.log('当前资源总数:',assetManager.assets.count)
    }
    /**
     * getAssetInfo
     * @param path          资源路径
     * @param type          资源类型
     * @param bundleName    远程资源包名
    */
    public getInfoWithPath<T extends Asset>(path: string, type?: __private._types_globals__Constructor<T> | null, bundleName?: string): __private._cocos_asset_asset_manager_config__IAddressableInfo | null {
        if (bundleName == null) bundleName = this.defaultBundleName;
        console.log(`getInfoWithPath+bundleName=`+bundleName);
        
       
        var bundle: AssetManager.Bundle = assetManager.getBundle(bundleName)!;
        return bundle.getInfoWithPath(path, type);
    }

    /**
     * getAssetInfo
     * @param uuid          资源路径
     */
    public getAssetInfo(uuid:string, bundleName?: string) : __private._cocos_asset_asset_manager_config__IAddressableInfo | null{
        if (bundleName == null) bundleName = this.defaultBundleName;
        console.log(`getAssetInfo+bundleName=`+bundleName);
        var bundle: AssetManager.Bundle = assetManager.getBundle(bundleName)!;
        if (bundle.getAssetInfo(uuid)) {
            return bundle.getAssetInfo(uuid) as __private._cocos_asset_asset_manager_config__IAddressableInfo;
        }
        return null;
    }


}