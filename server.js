// Ejercicio Práctico - CRUD parametrizado con Node + pg
require('dotenv').config({ path: '.env' });
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'index.html')));

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// GET /clientes (con filtros por Query Params)
app.get('/clientes', async (req, res) => {
    const { rut, edad, nombre } = req.query;
    let query = { text: 'SELECT * FROM clientes', values: [] };

    if (rut) {
        query = { text: 'SELECT * FROM clientes WHERE rut = $1', values: [rut] };
    } else if (edad) {
        query = { text: 'SELECT * FROM clientes WHERE edad = $1', values: [edad] };
    } else if (nombre) {
        query = { text: 'SELECT * FROM clientes WHERE nombre ILIKE $1', values: [`${nombre}%`] };
    }

    try {
        const { rows } = await pool.query(query);
        res.json({ ok: true, data: rows });
    } catch (err) {
        res.status(500).json({ ok: false, mensaje: err.message });
    }
});

// POST /clientes
app.post('/clientes', async (req, res) => {
    const { rut, nombre, edad } = req.body;
    if (isNaN(edad)) return res.status(400).json({ ok: false, mensaje: "Edad debe ser numérica" });

    const query = {
        text: 'INSERT INTO clientes (rut, nombre, edad) VALUES ($1, $2, $3) RETURNING *',
        values: [rut, nombre, edad]
    };

    try {
        const { rows } = await pool.query(query);
        res.status(201).json({ ok: true, data: rows[0] });
    } catch (err) {
        const status = err.code === '23505' ? 409 : 500;
        res.status(status).json({ ok: false, mensaje: err.code === '23505' ? "RUT ya existe" : err.message });
    }
});

// DELETE /clientes (Protección contra borrado masivo)
app.delete('/clientes', async (req, res) => {
    const { rut, nombre, edad } = req.query;
    let filterText = '';
    let values = [];

    if (rut) { filterText = 'rut = $1'; values = [rut]; }
    else if (nombre) { filterText = 'nombre = $1'; values = [nombre]; }
    else if (edad) { filterText = 'edad = $1'; values = [edad]; }
    else { return res.status(400).json({ ok: false, mensaje: "Especifique un criterio" }); }

    try {
        // Validar cuántos registros coinciden antes de borrar
        const checkQuery = { text: `SELECT count(*) FROM clientes WHERE ${filterText}`, values };
        const { rows } = await pool.query(checkQuery);
        
        if (parseInt(rows[0].count) > 1) {
            return res.status(400).json({ ok: false, mensaje: "Más de una coincidencia. Refine el criterio para evitar borrado masivo." });
        }

        const deleteQuery = { text: `DELETE FROM clientes WHERE ${filterText}`, values };
        const { rowCount } = await pool.query(deleteQuery);
        
        if (rowCount === 0) return res.status(404).json({ ok: false, mensaje: "Cliente no existe" });
        res.json({ ok: true, rowCount, mensaje: "Eliminado correctamente" });
    } catch (err) {
        res.status(500).json({ ok: false, mensaje: err.message });
    }
});

// PUT /clientes/:rut
app.put('/clientes/:rut', async (req, res) => {
    const { rut } = req.params;
    const { nombre } = req.body;
    const query = { text: 'UPDATE clientes SET nombre = $1 WHERE rut = $2', values: [nombre, rut] };

    try {
        const { rowCount } = await pool.query(query);
        if (rowCount === 0) return res.status(404).json({ ok: false, mensaje: "No encontrado" });
        res.json({ ok: true, rowCount, mensaje: "Actualizado correctamente" });
    } catch (err) {
        res.status(500).json({ ok: false, mensaje: err.message });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(3000, () => console.log("Servidor OK en puerto 3000"));
