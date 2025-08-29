import { AssetManager } from "cc";
import { MyDefine } from "../../data/MyDefine";
import { BundleLoader } from "./BundleLoader";


export const ResMainBundle = () => MyBundles.Remotemain;
// 定义类型别名
export type BundlesCallback = (err: Error | null, bundles?: AssetManager.Bundle[]) => void;
export class MyBundles {
    static Remotemain:BundleLoader= null;
    // static RemoteShop:BundleLoader= null;

    static init() {
        this.Remotemain = new BundleLoader(
            MyDefine.get("remotemainBundleName"),
            MyDefine.get("remotemainBundleVersion")
        );
        // this.RemoteShop = new BundleLoader(
        //     MyDefine.get("remoteShopBundleName"),
        //     MyDefine.get("remoteShopBundleVersion")
        // );
    }
    static get AllBundles() {
        return [this.Remotemain];
    }
    static getBundleByName(name: string) {
        if(name === MyDefine.get("remotemainBundleName","mainResources")) {
            return this.Remotemain;
        }
        return null;
    }
    /**
     * 加载所有远程包（如 Remotemain、RemoteShop）。
     * 并发加载所有 BundleLoader 实例，全部加载完成后回调。
     * @param onComplete 加载完成后的回调函数，参数为错误信息和已加载的 bundle 数组
     * const loaders = [this.Remotemain].filter(Boolean);只需要在[this.Remotemain]这里面添加需要加载的 BundleLoader 实例即可。
     */
    static preloadBundle(onComplete?: BundlesCallback) {
        const loaders = [this.Remotemain].filter(Boolean);
        if (loaders.length === 0) {
            onComplete?.(new Error("bundles not initialized"));
            return;
        }
        const loadBundle = (loader: BundleLoader) => new Promise<AssetManager.Bundle>((resolve, reject) => {
            loader.loadSmartBundle(undefined, undefined, (err, bundle) => {
                if (err || !bundle) reject(err || new Error("bundle is undefined"));
                else resolve(bundle);
            });
        });
        Promise.all(loaders.map(loadBundle))
            .then(bundles => onComplete?.(null, bundles))
            .catch(err => onComplete?.(err));
    }
}