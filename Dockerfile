FROM node:lts-buster

RUN git clone https://github.com/Ainz-fkk/OVL-MD-SESSION-ID /root/OVL-MD-SESSION-ID

WORKDIR /root/OVL-MD-SESSION-ID

COPY package.json .
RUN npm i
COPY . .

EXPOSE 8000

CMD ["npm","run","Ovl"]
