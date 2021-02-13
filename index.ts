import superagent from 'superagent';
import path from 'path';
import fs from 'fs';
import config from './config.json';
import AdmZip from 'adm-zip';

const baseUrl = 'http://www.winkawaks.org/';
const dlClientRoute = 'kawaks/WinKawaks.full.zip';
const dlRomsRoute = 'roms/full-rom-list.htm';

const checkDir = () => {
    console.log(`check dir started!`);
    console.log(`checking base dir: ${config.targetDir}`);
    console.log(`target folder ${fs.existsSync(config.targetDir) ? '' : 'un'}detected, ${fs.existsSync(config.targetDir) ? '' : 'creating base folder'}`);
    !fs.existsSync(config.targetDir) && fs.mkdirSync(config.targetDir);
}

const dlClient = async () => {
    console.log(`client download started!`);
    if (fs.existsSync(path.resolve(config.targetDir, 'WinKawaks'))) {
        console.log(`client detected and skipped!`);
        return;
    }
    const { body: rawClientData } = await superagent.get((new URL(dlClientRoute, baseUrl)).href);
    const files = new AdmZip(rawClientData);
    files.extractAllToAsync(config.targetDir, true);
    console.log(`client downloaded!`);
}

const dlTask = async (type: 'neogeo'|'cps1'|'cps2', detailUrlArr:string[]) => {
    let i = 0;
    let downloadedCount = 0;
    const dlUrlReg = /<a href="http:\/\/dl.winkawaks.org\/roms\/\S+ /
    const fileList = fs.readdirSync(path.resolve(config.targetDir, 'WinKawaks', 'roms', type));
    for (const detailUrl of detailUrlArr) {
        const { text: detailPage } = await superagent.get((new URL(detailUrl, baseUrl)).href);
        const dlUrl = detailPage.match(dlUrlReg)![0].slice(9, -2);
        const matchReg = /\//g;
        let fileName = '';
        let matchResult:RegExpExecArray|null;
        while (matchResult = matchReg.exec(dlUrl)) {
            fileName = dlUrl.slice(matchResult.index + 1);
        }
        if (fileList.includes(fileName)) {
            console.log(`found rom file locally at ${path.resolve(config.targetDir, 'WinKawaks', 'roms', type, fileName)}, skipped. ${++i}/${detailUrlArr.length}`);
            downloadedCount++;
            console.log(`downloaded ${downloadedCount}/${detailUrlArr.length}`);
            continue;
        }
        console.log(`downloading ${type} roms: ${++i}/${detailUrlArr.length}, current ${fileName}`);
        console.log(`downloading from ${dlUrl}`);

        if (config.useAsync) {
            await new Promise((resolve, reject) => {
                superagent.get(dlUrl, (err, res) => {
                    if (err) {
                        console.log(err);
                        resolve('');
                    } else {
                        downloadedCount++;
                        console.log(`downloaded ${downloadedCount}/${detailUrlArr.length}`);
                        fs.writeFileSync(path.resolve(config.targetDir, 'WinKawaks', 'roms', type, fileName), res.body);
                        console.log(`downloaded ${type} rom '${fileName}' success for ${(res.body.byteLength / 1024).toFixed(2)} KB`);
                        resolve('');
                    }
                });
            });
        } else {
            superagent.get(dlUrl, (err, res) => {
                if (err) {
                    console.log(err);
                } else {
                    downloadedCount++;
                    console.log(`downloaded ${downloadedCount}/${detailUrlArr.length}`);
                    fs.writeFileSync(path.resolve(config.targetDir, 'WinKawaks', 'roms', type, fileName), res.body);
                    console.log(`downloaded ${type} rom '${fileName}' success for ${(res.body.byteLength / 1024).toFixed(2)} KB`);
                }
            });
        }
    }
}

const dlRoms = async () => {
    console.log(`downloading roms start!`);
    const { text: rawListPage } = await superagent.get((new URL(dlRomsRoute, baseUrl)).href);
    const neogeoDetailPageReg = /<a href="neogeo\/\S+ /g;
    const cps1DetailPageReg = /<a href="cps1\/\S+ /g;
    const cps2DetailPageReg = /<a href="cps2\/\S+ /g;
    config.downLoadNeogeo && await dlTask('neogeo', rawListPage.match(neogeoDetailPageReg)!.map((rowRoute) => {
        return 'roms/' + rowRoute.slice(9, -2).replace('.htm', '-download.htm');
    }));
    config.downLoadCPS1 && await dlTask('cps1', rawListPage.match(cps1DetailPageReg)!.map((rowRoute) => {
        return 'roms/' + rowRoute.slice(9, -2).replace('.htm', '-download.htm');
    }));
    config.downLoadCPS2 && await dlTask('cps2', rawListPage.match(cps2DetailPageReg)!.map((rowRoute) => {
        return 'roms/' + rowRoute.slice(9, -2).replace('.htm', '-download.htm');
    }));
}

const run = async () => {
    checkDir();
    config.downLoadClient && await dlClient();
    (config.downLoadNeogeo || config.downLoadCPS1 || config.downLoadCPS2) && await dlRoms();
}

run();