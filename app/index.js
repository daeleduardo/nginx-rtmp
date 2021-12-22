//Variáveis e parâmetros globais.
const fs = require('fs');
const nginxConfigFile = "/etc/nginx/nginx.conf";
const express = require('express');
const app = express()
const port = 80

//Inicia a aplicação na porta informada.
app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})

//Retona uma conexão com o banco de dados.
const getConn = () => {
    const sqlite3 = require('sqlite3').verbose();
    return new sqlite3.Database('sample.db');
}

//Executa uma comando no shell.
const sheelCommand = (cmd) => {
    const { exec } = require("child_process");
    exec(cmd, (error, stdout, stderr) => {
        console.log(`command: ${cmd}`);
        if (error) {
            console.log(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.log(`stderr: ${stderr}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
    });
}

//Recarrega as configurações do nginx.
//Encerra todos os processos do grupo nobody (usado pelos workers do Nginx) cujo comando está com a descrição "'nginx: worker process is shutting down'"
//Além de recarregar o arquivo de configuração do NGINX esse comando de encerrar processo é executado para encerrar qualquer worker que esteja rodando, 
//cujo acesso foi revogado, já que os workers que não foram revogados serão reiniciados.
const nginxReload = () => {
    return sheelCommand("nginx -s reload && sleep 1 && ps aux | grep nobody | grep 'nginx: worker process is shutting down' | awk '{print $2}' | xargs kill ");

}

//Reescreve o arquivo de configuração do NGINX com base nos tokens gerados.
const refreshNginxConfigFile = (key) =>{

    try {

        const db = getConn();
        const sql = "select * from keys";
        const params = [];
        let applications = "";
        let index = 0;
        db.all(sql, params, (err, rows) => {
            rows.forEach((row) => {
                applications += `
                                application ${row.token} {
                                    live on;
                                    record off;
                                }
                `;
                index++;
                if(index == rows.length){

                    const contentFile = `
                    worker_processes auto;
                    rtmp_auto_push on;
                    events {}
                    rtmp {
                        server {
                            listen 1935;
                            listen [::]:1935 ipv6only=on;
            
                            ${applications}
                        }
                    }
                    `;

                    fs.writeFile(nginxConfigFile, contentFile, function (errToWrite) {
                        if (errToWrite) throw errToWrite;
                        nginxReload();
                        console.log(`Change in ${key} Saved!`);
                    });
                }
            });

            if (err) throw err;            
        });

    } catch (error) {
        console.error(error);
    }
}

//Gera um token aleatório, os números são removidos, pois aparentemente o NGINX não aceita aplicações com números.
const randomHash = () => {
    return String(  
                (Math.random() + 1).toString(36).substring(7) + 
                (Math.random() + 1).toString(36).substring(7) + 
                (Math.random() + 1).toString(36).substring(7)
                ).replace(/\d/g,"");
}


//Cria a tabela de tokens caso ainda não exista.
app.get('/', (req, res) => {
    try {
        const db = getConn();
        db.run('CREATE TABLE IF NOT EXISTS keys(token text)');
        db.close();
    } catch (error) {
        console.error(error);
    } finally {
        res.sendFile(__dirname+'/index.html');
    }
})

//Cria um token.
app.post('/', (req, res) => {
    try {
        const db = getConn();
        const token = randomHash();
        db.run(`INSERT INTO keys VALUES('${token}')`);
        db.close();
        refreshNginxConfigFile(token);
        nginxReload();
        res.json({
            "message":"success",
            "data":true
        })
    } catch (error) {
        console.error(error);
        res.json({
            "message":"error",
            "data":false
        })
    }
})

//Retorna todos os tokens
app.get("/all", (req, res, next) => {
    try {
        const db = getConn();
        const sql = "select * from keys";
        const params = [];
        db.all(sql, params, (err, rows) => {
            if (err) {
                res.status(400).json({"error":err.message});
                return;
            }
            res.json({
                "message":"success",
                "data":rows
            })
        });
    } catch (error) {
        console.error(error);
        res.json({
            "message":"error",
            "data":false
        })
    }
});

//Remove um token com base no token informado.
app.delete('/:id', (req, res) => {
    try {
        const db = getConn();
        db.run(`delete from keys where token = '${req.params.id}'`, (err) => {
            if (err) return console.error(err);
            db.close();
            refreshNginxConfigFile(req.params.id);
        });
        res.json({
            "message":"success",
            "data":true
        })
    } catch (error) {
        console.error(error);
        res.json({
            "message":"error",
            "data":false
        })
    }
});

