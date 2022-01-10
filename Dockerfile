#Imagem que já possui o NGINX compilado com o módulo de rtmp
FROM tiangolo/nginx-rtmp

ENV TZ=America/Sao_Paulo
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

#Adiciona o repositório da versão do Node.js
RUN curl -sL https://deb.nodesource.com/setup_11.x | bash

#Atualiza os pacotes e o sistema.
RUN apt-get update -y && apt-get upgrade -y

#Pode ocorrer erros de escrita da aplicação NGINX nos logs.
#De modo preventivo o diretório é recriado é atribuito ao usuário www-data que por padrão é o usado pelo NGINX.
RUN rm -rf /var/log/nginx && \
    mkdir /var/log/nginx && \
    touch /var/log/nginx/error.log && \
    chown -R www-data:www-data /var/log/nginx && \
    chmod -fR 777 /var/log/nginx

#Cria a pasta onde irá ocorrer as gravações das câmeras
RUN mkdir /records  && \
    chown -R nobody:nogroup /records && \
    chmod -fR 700 /records

#Cria um arquivo de configuração para o NGINX com o RTMP, mas sem nenhuma aplicação
COPY ./hosts/nginx.conf /etc/nginx/nginx.conf

#Instala o Node e o NPM para rodar a aplicação de teste e o ffmpeg para testar o stream de video
RUN apt-get install -y nodejs npm nano ffmpeg

CMD ["nginx", "-g", "daemon off;"]