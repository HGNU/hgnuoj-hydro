import codeforces from './codeforces';
import hduoj from './hduoj';
import luogu from './luogu';
import poj from './poj';
import spoj from './spoj';
import uoj from './uoj';

declare module 'hydrooj/src/interface' {
    interface HydroGlobal {
        vjudge: typeof vjudge;
    }
}

const vjudge: Record<string, any> = {
    codeforces, hduoj, luogu, poj, spoj, uoj,
};
global.Hydro.vjudge = vjudge;
export = vjudge;
