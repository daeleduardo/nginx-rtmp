# NGINX RTMP

### Objetivo

Criar um protótipo de servidor RTMP para o streaming de vídeos, com uma aplicação de exemplo para testar o servidor.

### Diretórios

 - */app* - Aplicação de exemplo para testar o servidor
 - */hosts* - Arquivos de configuração do servidor (Desabilitado por padrão no arquivo docker-compose.yml)
 
 ### Usando o servidor RTMP

 Foi criada uma imagem docker para o servidor RTMP a imagem pode ser executada diretamente (docker run), ou usando o docker-compose (recomendado).
 O servidor é iniciado junto com o container, executando o comando abaixo, dentro do diretório raiz do projeto:

```console
docker-compose up -d
```

 ### Usando a aplicação de testes

É necessário instalar as dependências da aplicação:
```console
docker exec -it nginx-rtmp  bash -c "cd /app && npm install && npm audit fix"
```
Para iniciar a aplicação execute o comando abaixo dentro do container:
```javascript
node /app/index.js
```
Por padrão o endereço para acessar a aplicação é http://localhost:80, mas pode ser alterada a porta, editando o arquivo ```index.js``` na pasta ```/app```

Caso tenha problemas, para acessar pelo localhost, caso esteja usando o WSL, é necessário acessar diretamente pelo IP da máquina WSL, para descobrir o IP máquina, acesse a máquina WSL e execute o comando (ignore o /número no final):
```console
sudo ip addr | grep inet | grep global | awk '{print $2}'
```

Para cadastrar uma nova chave clique no botão da aplicação "+", para remover clique no "x" do lado direito do valor da chave.

 ### Testando o servidor

 Para realizar o streaming de um video use o seguinte comando abaixo dentro da pasta ```/app``` (pode ser por dentro ou fora do container):

```console
ffmpeg -re -i exemplo.m4v -vcodec libx264 -vprofile baseline -g 30 -acodec aac -strict -2 -f flv rtmp://localhost/{chave_gerada_pelo_aplicativo_teste}
```

Para reproduzir o streaming do video use o seguinte comando abaixo (fora do container):

ffplay rtmp://localhost/{chave_gerada_pelo_aplicativo_teste}
