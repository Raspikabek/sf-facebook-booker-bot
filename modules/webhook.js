"use strict";

let request = require('request'),
    salesforce = require('./salesforce'),
    formatter = require('./formatter-messenger');

let sendMessage = (message, recipient) => {
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: process.env.FB_PAGE_TOKEN},
        method: 'POST',
        json: {
            recipient: {id: recipient},
            message: message
        }
    }, (error, response) => {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    });
};

let processText = (text, sender)  => {
    let match;
    match = text.match(/help/i);
    if (match) {
        sendMessage({text:
            `You can ask me things like:
    Search account Acme
    Search Acme in accounts
    Search contact Louis
    What are my 3 top opportunities?
        `}, sender);
        return;
    }

    match = text.match(/(ayudarme|ayuda|ayudame)/i);
    if (match) {
        sendMessage({text:
            `Puedes preguntarme cosas como:
    Busca la cuenta Acme
    Busca Acme en cuentas
    Busca el contacto Raspi
    ¿Cuales son mis 3 mejores oportunidades?
        `}, sender);
        return;
    }

    match = text.match(/gracias/i);
    if (match) {
        sendMessage({text:
            `De nada, y recuerda... Que la Force te acompañe`}, sender);
        return;
    }

    match = text.match(/(thank you|thanks|thx)/i);
    if (match) {
        sendMessage({text:
            `You're welcome my friend. And remember, May the Force.com be with you`}, sender);
        return;
    }

    match = text.match(/hola/i);
    if (match) {
        sendMessage({text:
            `Guau hola! Soy Booker Bot. Si necesitas ayuda tan solo pídemela`}, sender);
        return;
    }

    match = text.match(/(hi|hello|greetings)/i);
    if (match) {
        sendMessage({text:
            `Woof hi! I'm Booker Bot. I'm here to help you!`}, sender);
        return;
    }
    
    match = text.match(/mata a (.*)/i);
    if (match) {
        sendMessage({text:
            `Objetivo fijado. Procesando la ejecución de "${match[1]}"...`}, sender);
        return;
    }

    match = text.match(/(busca la cuenta (.*)|buscar la cuenta (.*)|busca (.*) en cuentas)/i);
    if (match) {
        salesforce.findAccount(match[1]).then(accounts => {
            sendMessage({text: `Estas son las cuentas que he encontrado al buscar "${match[1]}":`}, sender);
            sendMessage(formatter.formatAccounts(accounts), sender)
        });
        return;
    }

    match = text.match(/search account (.*)/i);
    if (match) {
        salesforce.findAccount(match[1]).then(accounts => {
            sendMessage({text: `Here are the accounts I found matching "${match[1]}":`}, sender);
            sendMessage(formatter.formatAccounts(accounts), sender)
        });
        return;
    }
	
	match = text.match(/Busca el caso (.*)/i);
    if (match) {
        salesforce.findCases(match[1]).then(cases => {
            sendMessage({text: `Aquí está el caso: "${match[1]}":`}, sender);
            sendMessage(formatter.formatCases(cases), sender)
        });
        return;
    }

    match = text.match(/search case (.*)/i);
    if (match) {
        salesforce.findCases(match[1]).then(cases => {
            sendMessage({text: `Here're the cases I found matching: "${match[1]}":`}, sender);
            sendMessage(formatter.formatCases(cases), sender)
        });
        return;
    }

    match = text.match(/busca el contacto (.*)/i);
    if (match) {
        salesforce.findContact(match[1]).then(contacts => {
            sendMessage({text: `Estos son los contactos que he encontrado al buscar "${match[1]}":`}, sender);
            sendMessage(formatter.formatContacts(contacts), sender)
        });
        return;
    }

    match = text.match(/(search contact (.*)|search (.*) in contacts)/i);
    if (match) {
        salesforce.findContact(match[1]).then(contacts => {
            sendMessage({text: `Here're the contacts I found matching: "${match[1]}":`}, sender);
            sendMessage(formatter.formatContacts(contacts), sender)
        });
        return;
    }

    match = text.match(/(.*) mejores oportunidades/i);
    if (match) {
        salesforce.getTopOpportunities(match[1]).then(opportunities => {
            sendMessage({text: `Aquí están tus ${match[1]} mejores oportunidades:`}, sender);
            sendMessage(formatter.formatOpportunities(opportunities), sender)
        });
        return;
    }

    match = text.match(/ (.*) top opportunities/i);
    if (match) {
        salesforce.getTopOpportunities(match[1]).then(opportunities => {
            sendMessage({text: `Here are your top ${match[1]} opportunities:`}, sender);
            sendMessage(formatter.formatOpportunities(opportunities), sender)
        });
        return;
    }

    /*if (!match) {
        sendMessage({text: `Lo siento, no te he entendido. Si necesitas ayuda escribe "ayudame".`}, sender);
        return;
    }*/
};

let handleGet = (req, res) => {
    if (req.query['hub.verify_token'] === process.env.FB_VERIFY_TOKEN) {
        res.send(req.query['hub.challenge']);
    }
    res.send('Error, wrong validation token');
};

let handlePost = (req, res) => {
    let events = req.body.entry[0].messaging;
    for (let i = 0; i < events.length; i++) {
        let event = events[i];
        let sender = event.sender.id;
        if (process.env.MAINTENANCE_MODE && ((event.message && event.message.text) || event.postback)) {
            sendMessage({text: `Sorry I'm taking a break right now.`}, sender);
        } else if (event.message && event.message.text) {
            processText(event.message.text, sender);
        } else if (event.postback) {
            let payload = event.postback.payload.split(",");
            if (payload[0] === "view_contacts") {
                sendMessage({text: "Looking for the trail of " + payload[2] + " contacts..."}, sender);
                salesforce.findContactsByAccount(payload[1]).then(contacts => sendMessage(formatter.formatContacts(contacts), sender));
            } else if (payload[0] === "view_notes") {
                sendMessage({text: "Just a moment, I'm looking for notes at " + payload[2] + "..."},sender);
                salesforce.findNotesByContact(payload[1]).then(notes => sendMessage(formatter.formatNotes(notes),sender));
            } else if (payload[0] === "close_won") {
                sendMessage({text: `Opportunity "${payload[2]}" closed as "Closed Won". (BETA, didnt update opp)`}, sender);
            } else if (payload[0] === "close_lost") {
                sendMessage({text: `I'm sorry to hear that. I closed the opportunity "${payload[2]}" as "Close Lost". (BETA, didnt update opp)`}, sender);
            }
        }
    }
    res.sendStatus(200);
};

exports.handleGet = handleGet;
exports.handlePost = handlePost;