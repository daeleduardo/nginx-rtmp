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

//Cria a pasta para guardar as gravações do token informado.
const createNginxFolder = (token) => {
    return sheelCommand(`mkdir -p /records/${token} && chown -R nobody:nogroup /records/${token} && chmod -fR 700 /records/${token}`);
}



//Reescreve o arquivo de configuração do NGINX com base nos tokens gerados.
const refreshNginxConfigFile = (key = "") => {

    try {

        const db = getConn();
        const sql = "select * from keys";
        const params = [];
        let applications = "";
        let index = 0;

        db.all(sql, params, (err, rows) => {

            if (!Object.prototype.hasOwnProperty.call(rows, 'length') || rows.length == 0) {
                return;
            }

            //Cria-se uma pasta para armazenar as gravações do token recém criado.
            if (key != "") {
                createNginxFolder(key);
            }

            rows.forEach((row) => {
                applications += `
                                application ${row.token} {
                                    record_path /records/${row.token};
                                    record_suffix ${row.token}_%F-%T.flv;
                                }
                `;
                index++;
                //Se nehum token foi informado, entende-se que é a primeira vez que o arquivo é gerado.
                //Então todas as pasta de gravação serão criadas (se já existirem não serão criadas novamente).
                if (key == "") {
                    createNginxFolder(row.token);
                }
                if (index == rows.length) {

                    const contentFile = `
                    worker_processes auto;
                    rtmp_auto_push on;
                    events {}
                    rtmp {
                        server {
                            listen 1935;
                            listen [::]:1935 ipv6only=on;

                            live on;
                            record_interval 1m;
                            record all;
            
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
    ).replace(/\d/g, "");
}


//Cria a tabela de tokens caso ainda não exista.
app.get('/', (req, res) => {
    try {
        const db = getConn();
        db.run('CREATE TABLE IF NOT EXISTS keys(token text)');
        refreshNginxConfigFile();
        db.close();
    } catch (error) {
        console.error(error);
    } finally {
        res.sendFile(__dirname + '/index.html');
    }
})

//Cria um token.
app.post('/', (req, res) => {
    try {
        const db = getConn();
        const token = randomHash();
        db.run(`INSERT INTO keys VALUES('${token}')`);
        db.close();
        setTimeout(() => {
            refreshNginxConfigFile(token);
            res.json({
                "message": "success",
                "data": true
            });
        }, 500);
    } catch (error) {
        console.error(error);
        res.json({
            "message": "error",
            "data": false
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
                res.status(400).json({ "error": err.message });
                return;
            }
            res.json({
                "message": "success",
                "data": rows
            })
        });
    } catch (error) {
        console.error(error);
        res.json({
            "message": "error",
            "data": false
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
            "message": "success",
            "data": true
        })
    } catch (error) {
        console.error(error);
        res.json({
            "message": "error",
            "data": false
        })
    }
});

