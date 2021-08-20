const puppeteer = require('puppeteer');
const fs = require('fs');
const { start } = require('repl');

var start_dates = [];
var end_dates = [];

for (y = 2010; y <= 2021; y++) {
    for (m = 0; m <= 11; m++) {
        start_dates.push('01' + String(m + 1).padStart(2, '0') + String(y));
        end_dates.push(String(new Date(y, m + 1, 0).getDate()).padStart(2, '0') + String(m + 1).padStart(2, '0') + String(y));
    }
}

async function testWait() {
    await wait(5000);
}

console.log(start_dates);
console.log(end_dates);

(async () => {

    const browser = await puppeteer.launch({ headless: false, slowMo: 180, }); //spawns chromium. change headless if you wanna see it popping
    page = (await browser.pages())[0];
    await page.setViewport({ 'width': 1920, 'height': 1080 });
    await page._client.send('Emulation.clearDeviceMetricsOverride');
    await page._client.send('Network.enable', {
        maxResourceBufferSize: 1024 * 1204 * 100,
        maxTotalBufferSize: 1024 * 1204 * 200,
    })
    await page.setUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'); //ever wanted to be a 1.6T dollar company?
    await page.setDefaultNavigationTimeout(0);
    await page.goto('https://www.rad.cvm.gov.br/ENET/frmConsultaExternaCVM.aspx', { waitUnil: 'networkidle0' }); //url


    // historic crawl
    var i = 0;
    console.log("debug");

    await page.evaluate(() => {
        var periodCheck = document.querySelector('input#rdPeriodo');
        periodCheck.click();
    })
    await page.type('input#txtDataIni', start_dates[i]);
    await page.type('input#txtDataFim', end_dates[i]);
    await page.evaluate(() => {
        var button = document.querySelector('input#btnConsulta');
        button.click();
    })

    console.log("click")

    await save(await prep(await crawl()), end_dates[i].slice(4, 8) + '-' + end_dates[i].slice(2, 4) + ' - Documentos Entregues à CVM.tsv');

    for (var i = 1; i < 138; i++) {

        await page.evaluate(() => {
            var show = document.querySelector('span#textoDivPesquisa');
            show.click();
        })
        await page.evaluate(() => {
            var periodCheck = document.querySelector('input#rdPeriodo');
            periodCheck.click();
        })

        const inputStart = await page.$('input#txtDataIni');
        await inputStart.click({ clickCount: 3 })
        await inputStart.type(start_dates[i]);
        const inputEnd = await page.$('input#txtDataFim');
        await inputEnd.click({ clickCount: 3 })
        await inputEnd.type(end_dates[i]);

        await page.evaluate(() => {
            var button = document.querySelector('input#btnConsulta');
            button.click();
        })

        console.log("beforecrawl");
        await save(await prep(await crawl()), end_dates[i].slice(4, 8) + '-' + end_dates[i].slice(2, 4) + ' - Documentos Entregues à CVM.tsv');
        console.log("here");
        console.log(i);
        testWait();
    }
    console.log("congrats, you've beaten the game");
    await browser.close();


    //waitForResponse after recaptcha's webworker solves its challenge,
    //effectively simulating a legitimate browser.
    //grabs all the available data for the day, in a similar way an API would've done.
    async function crawl() {
        try {
            let [response] = await Promise.all([
                page.waitForResponse(response => response.url().includes('/ListarDocumentos'))
            ]);
            let dataObj = await response.json();
            return dataObj.d.dados; //jackpot  
        } catch (error) {
            console.log(error);
        }

    }

    //data prepping
    async function prep(data) {
        let lines_regex = /\$\&\&\*/g;
        let separator_regex = /\$\&/g;

        let stage1 = data.replace(lines_regex, '\n');
        let stage2 = stage1.replace(separator_regex, '\t');
        let stage3 = stage2.replace(/\<spanOrder\>(.*?)\<\/spanOrder\>/g, '');
        // fs.writeFileSync('./cvm_debug.txt', stage3);
        let visualizer = stage3.replace(/(.*?\t.*?\t.*?\t.*?\t.*?\t.*?\t.*?\t.*?\t.*?\t.*?)\t(.*VisualizarDocumento.*?(onclick=(OpenPopUpVer\(\'(.*?)\')*.*?\)).*?)*(.*)/g,
        '$1\thttps\:\/\/www\.rad\.cvm\.gov\.br\/ENET\/$5\t$6');
        // fs.writeFileSync('./cvm_debug2.txt', visualizer);
        let downloader = visualizer.replace(/(.*)\t.*fi-download.*(OpenDownloadDocumentos\(\'([0-9]+)\'\,\'([0-9]+)\'\,\'([0-9A-Z\-]+)\'\,\'(.*?)\'\))(.*mostraLocaisPublicacao\(\'.*\@\!\@(.*?)\@\!\@(.*?)\@\!\@(.*?)\'.*)*.*\t(.*)/g,
        '$1\t$3\t$4\t$5\t$6\t$8\t$9\t$10\t$11');
        // fs.writeFileSync('./cvm_debug3.txt', downloader);
        let stage5 = downloader.replace(/\"/g,'\'');
        let stage6 = stage5.replace(/(.*?)\t(.*?)\t(.*?)\t(.*?)\t(.*?)\t(.*?)\t ([0-9]{2})\/([0-9]{2})\/([0-9]{4})( [0-9]{2}:[0-9]{2})\t(.*?)\t(.*?)\t(.*?)\t(.*?)\t(.*?)\t(.*?)\t(.*?)\t(.*?)\t(.*?)\t(.*?)\t(.*?)\t(.*?)\n/g,
          '"$1","$2","$3","$4","$5","$6","$9\/$8\/$7$10","$11",$12,"$13","$14",$15,$16,"$17","$18","$19","$20","$21","$22"\n'
        );
    
        let stage7 = stage6.replace(/\" | \"/g, '"');
        return stage7;
      }

    // save as {yyyy}-{mm} - Documentos Entregues à CVM.csv
    async function save(content, filename) {
        var header = 'Código CVM,Empresa,Categoria,Tipo,Espécie,Data Referência,Data Entrega,Status,V,Modalidade,URL,numSequencia,numVersao,numProtocolo,descTipo,Publicação - URL,Publicação - Data,Publicação - UF,Assunto\n';
        fs.writeFileSync(filename, header, 'utf8');
        await fs.appendFileSync(filename, content, 'utf8');
        console.log('We out here');
    }
})();