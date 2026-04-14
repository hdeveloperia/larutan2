import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Ruta explícita para la carta imprimible (soluciona problemas de acceso)
app.get('/Carta_RutaN2_Printable.html', (req, res) => {
    res.sendFile(process.cwd() + '/Carta_RutaN2_Printable.html');
});

// Configuración de Google Calendar API
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];
let calendar;

try {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: SCOPES,
    });
    calendar = google.calendar({ version: 'v3', auth });
    console.log("✅ API de Google Calendar configurada exitosamente.");
} catch (error) {
    console.warn("⚠️ Advertencia: No se han proporcionado credenciales válidas de Google Calendar en el archivo .env");
}

app.post('/api/reservar', async (req, res) => {
    try {
        const { name, eventType, date, time, people, phone, notes } = req.body;
        
        if (!process.env.GOOGLE_CLIENT_EMAIL || !calendar) {
            console.log("Mock enviando reserva a la terminal:" , req.body);
            return res.status(200).json({ success: true, mock: true, message: "Modo simulado: Servidor aún sin credenciales reales en .env. Reserva enviada a consola." });
        }

        // Crear una fecha válida. (Para eventos sin hora, usamos 20:00 por defecto)
        const horaAsignada = (time && time !== "N/A" && time !== "") ? time : "20:00";
        const startDate = new Date(`${date}T${horaAsignada}:00+02:00`); 
        if (isNaN(startDate)) {
            return res.status(400).json({ success: false, message: "Formato de fecha u hora incorrecto." });
        }
        const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours duration

        const event = {
            summary: `Reserva: ${name} (${people} pers)`,
            description: `TIPO: ${eventType}\nTELEFONO: ${phone}\nPERSONAS: ${people}\nNOTAS/OBJECIONES: ${notes || 'Ninguna'}`,
            start: {
                dateTime: startDate.toISOString(),
                timeZone: 'Europe/Madrid',
            },
            end: {
                dateTime: endDate.toISOString(),
                timeZone: 'Europe/Madrid',
            },
        };

        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
        
        const response = await calendar.events.insert({
            calendarId: calendarId,
            resource: event,
        });

        res.status(200).json({ success: true, link: response.data.htmlLink, message: "Reserva guardada exitosamente en Calendar." });
    } catch (error) {
        console.error("Error al guardar reserva:", error);
        res.status(500).json({ success: false, message: "Hubo un error al comunicar con Google Calendar." });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor de Ruta N2 escuchando API local en http://localhost:${PORT}`);
});
