import { __private, Asset, assetManager, error, resources } from "cc";
import { MyBundles, ResMainBundle } from "./MyBundles";

type AssetType<T = any> = __private._types_globals__Constructor<T> | null;
type ProgressCallback = (finished: number, total: number, item: any) => void | null;
type CompleteCallback<T = any> = (err: Error | null, data: T) => void

function getBundleLoader(bundleName:string) {
    const bundle = MyBundles.getBundleByName(bundleName);
    if (bundle) {
        return bundle;
    }
    return resources
}

function getBundleLoaderByPaths(paths: string | string[]) {
    if(Array.isArray(paths)){
        paths = paths[0];
    }
    for(const bundle of MyBundles.AllBundles) {
        if(bundle){
            if(bundle.getInfoWithPath(paths)) {
                return bundle;
            }
        }
        
    }
    return resources;
}

export class ResLoader {
    // 跳转到对应的 BundleLoader 实例
    private static resGetBundleLoader(bundleName,paths){
        let bloder: any;
        if (typeof paths === "string" || paths instanceof Array) {
            bloder = getBundleLoader(bundleName);
        } else {
            bloder = getBundleLoaderByPaths(bundleName);
        }
        return bloder;
    }
    private static resGetBundleLoaderByPaths(path,bundleName?){
        let bloder: any;
        if (bundleName) {
            bloder = getBundleLoader(bundleName);
        } else {
            bloder = getBundleLoaderByPaths(path);
        }
        return bloder;
    }

    // 加载资源
    public static load<T extends Asset>(
            bundleName: string,
            paths?: string | string[] | AssetType<T> | ProgressCallback | CompleteCallback | null,
            type?: AssetType<T> | ProgressCallback | CompleteCallback | null,
            onProgress?: ProgressCallback | CompleteCallback | null,
            onComplete?: CompleteCallback | null,
        ): void {
            let bloder= this.resGetBundleLoader(bundleName,paths);
            bloder.load(bundleName, paths, type, onProgress, onComplete);
    }

    // 异步加载资源
    public static async loadAsync(
        bundleName: string,
        paths?: any,//string | string[] | AssetType<T> | ProgressCallback | CompleteCallback | null,
        type?: any//AssetType<T> | ProgressCallback | CompleteCallback | null,
    ) : Promise<any> {//Promise<T> {
        return new Promise((resolve, reject) => {
            this.load(bundleName, paths, type, (err: Error | null, asset: Asset) => {
                if (err) {
                    error(err.message);
                }
                resolve(asset)
            });
        });
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
    // 加载文件夹中的资源
    public static loadDir<T extends Asset>(
            bundleName: string,
            dir?: string | AssetType<T> | ProgressCallback | CompleteCallback | null,
            type?: AssetType<T> | ProgressCallback | CompleteCallback | null,
            onProgress?: ProgressCallback | CompleteCallback | null,
            onComplete?: CompleteCallback | null,
        ) {
        let bloder= this.resGetBundleLoader(bundleName,dir);
        bloder.loadDir(bundleName, dir, type, onProgress, onComplete);
    }

    // 释放资源
    public static release(path: string, bundleName?: string): void {
        let bloder= this.resGetBundleLoaderByPaths(path,bundleName);
        bloder.release(path);
    }

    // 释放文件夹中的资源
    public static releaseDir(path: string, bundleName?: string): void {
        ResMainBundle().releaseDir(path, bundleName);
    }
    

    // 获取资源
    public static get<T extends Asset>(
        path: string,
        type?: AssetType<T> | null,
        bundleName?: string
    ): T | null {
        let bloder= this.resGetBundleLoaderByPaths(path,bundleName);
        return bloder.get(path, type);
    }
    public static dump(str?: string){
        
    }

    // 获取资源信息
    public static getInfoWithPath<T extends Asset>(
        path: string,
        type?: AssetType<T> | null,
        bundleName?: string
    ): __private._cocos_asset_asset_manager_config__IAddressableInfo | null {
        let bloder= this.resGetBundleLoaderByPaths(path,bundleName);
        return bloder.getInfoWithPath(path, type);
    }
    public static getAssetInfo(uuid:string, bundleName?: string) : __private._cocos_asset_asset_manager_config__IAddressableInfo | null{
        let bloder: any;
        bloder = resources;
        if (bundleName) {
            bloder = getBundleLoader(bundleName);
        } 
        return bloder.getAssetInfo(uuid);
    }
}

// interface ILoadResArgs<T extends Asset> {
//     bundle?: string;
//     dir?: string;
//     paths: string | string[];
//     type: AssetType<T> | null;
//     onProgress: ProgressCallback | null;
//     onComplete: CompleteCallback | null;
// }
// const cache = new Map<string, Function>();
// export const ResLoader = new Proxy({} as BundleLoader , {
//     get(target, prop) {

//         const key = String(prop);
//         if(key == 'loadRemote'|| key=='getAssetInfo'){
//             const cacheKey = `Remotemain_${key}`;
//             if (!cache.has(cacheKey)) {
//                 cache.set(cacheKey, (MyBundles.Remotemain as any)[key].bind(MyBundles.Remotemain));
//             }
//             return cache.get(cacheKey)!;
//         }
//         if (key === 'loadAsync') {
//             return (...args: any[]) => {
//                 let bloder = getBundleLoaderTw(key, args);
//                 if (bloder.loadAsync) {
//                     // 如果有原生的 loadAsync，直接用
//                     return bloder.loadAsync(...args);
//                 } else {
//                     // 否则手动 Promise 化
//                     return new Promise((resolve, reject) => {
//                         bloder.load(...args, (err: Error | null, asset: Asset) => {
//                             if (err) {
//                                 error(err.message);
//                                 reject(err);
//                             } else {
//                                 resolve(asset);
//                             }
//                         });
//                     });
//                 }
//             };
//         }
//         return (...args: any[]) =>handleProp(key, args)(...args);     
//     }
// });
// function handleProp(key: string, args: any[]) {
//      let bloder: any;
//     let cacheKey: string;
//     bloder = getBundleLoaderTw(key, args);
//     cacheKey = `${bloder.name}_${key}`;
//     if (!cache.has(cacheKey)) {
//         cache.set(cacheKey, bloder[key].bind(bloder));
//     }
//     return cache.get(cacheKey)!;
// }
    
// function getBundleLoaderTw(key: string, args: any[]){
//     let bloder: any;
//     if(key == 'load' || key == 'loadDir'|| key == 'loadAsync') {
//         const firstArg = args[0];
//         if(args[1] !== undefined && (typeof args[1] === 'string' || Array.isArray(args[1]))) {
//             // 如果第二个参数是字符串或数组,说明第一个参数是bundleName
//             bloder = getBundleLoader(firstArg);
//         }//否则第一个参数就是paths
//         else{
//             bloder = getBundleLoaderByPaths(firstArg);
//         }
//     }
//     else if(key =='release'||key=='releaseDir' || key=='get' || key=='getInfoWithPath'){
//         const firstArg = args[0];
//         if(args[1] !== undefined && typeof args[1] === 'string') {
//             // 如果第二个参数是字符串,说明第二个参数是bundleName，参考原方法release(path: string, bundleName?: string) 
//             bloder = getBundleLoader(args[1]);
//         }//否则第一个参数就是paths
//         else{
//             bloder = getBundleLoaderByPaths(firstArg);
//         } 
//     }
//     else{
//         bloder = MyBundles.Remotemain
//     }
//     return bloder;
// }