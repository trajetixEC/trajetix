# 💳 Módulo de Billetera (Wallet) y Finanzas — TrajetixERP

Documento funcional y de negocio que describe el comportamiento, la seguridad, los saldos y el historial de transacciones del módulo financiero de TrajetixERP.

---

## 🎯 1. Visión General

La **Billetera Trajetix (Wallet)** es el centro contable y financiero de cada tienda en la plataforma. Permite gestionar los ingresos por recaudos de **Cobro Contra Entrega (COD)**, pagar fletes de envíos prepagados, controlar saldos pendientes de paquetes en tránsito y solicitar retiros de dinero a cuentas bancarias de forma segura.

---

## 💰 2. Los 3 Saldos de la Billetera

En el panel financiero de la tienda se visualizan **3 saldos bien diferenciados**:

```
 ┌───────────────────────────┐      ┌───────────────────────────┐      ┌───────────────────────────┐
 │    1. SALDO DISPONIBLE    │      │    2. SALDO PENDIENTE     │      │    3. SALDO BLOQUEADO     │
 │   Dinero real líquido y   │      │ Proyección de envíos COD  │      │  Retiros solicitados en   │
 │ listo para gastar/retirar │      │ en camino hacia el cliente│      │ proceso de aprobación     │
 └───────────────────────────┘      └───────────────────────────┘      └───────────────────────────┘
```

### 💵 1. Saldo Disponible (Dinero Real)
* **¿Qué es?**: Es el dinero real acreditado en la cuenta de la tienda.
* **¿Cómo aumenta?**: Cuando una transportadora entrega con éxito un pedido contra-entrega (COD), cuando un administrador aprueba una recarga o cuando se devuelve el dinero de un retiro rechazado.
* **¿Cómo disminuye?**: Al generar envíos con flete prepagado o cuando un retiro bancario es aprobado.

### ⏳ 2. Saldo Pendiente (Proyección de Cobros en Camino)
* **¿Qué es?**: Es una **estimación/proyección** del dinero que la tienda va a recibir por paquetes con Cobro Contra Entrega (COD) que ya están viajando con la transportadora pero aún no han sido entregados al cliente final.
* **Importante**: **No es dinero real**. No se puede retirar ni usar para pagar fletes hasta que el paquete figure como **Entregado**.

### 🔒 3. Saldo Bloqueado (Retiros en Proceso)
* **¿Qué es?**: Es dinero real que la tienda solicitó retirar a su cuenta bancaria. 
* **Función de Seguridad**: Se aparta temporalmente para evitar que la tienda lo gaste en nuevos envíos mientras un administrador revisa y aprueba la transferencia.

### 📤 Disponible para Retiro
* Equivale al **Saldo Disponible**. Al solicitar un retiro, ese dinero pasa al cajón de **Saldo Bloqueado** de inmediato, garantizando que nadie pueda solicitar dos retiros sobre el mismo dinero.

---

## 🔐 3. Validaciones de Seguridad al Crear Envíos

Para garantizar que nunca haya descuadres ni pérdidas de dinero, la plataforma aplica las siguientes reglas inviolables:

1. **El Pagador Nace de la Sesión Autenticada**:
   * Quien paga el envío es **siempre la tienda que inició sesión en el ERP**. No es posible enviar un parámetro en la solicitud para cargarle el flete a la billetera de otra empresa.

2. **Costo del Flete Calculado por el Servidor (Firma Criptográfica)**:
   * El precio del flete se calcula y firma criptográficamente en el servidor. Si un usuario intenta modificar el precio del flete desde el navegador, el sistema detecta la alteración e inhabilita la transacción al instante.

3. **Secuencia de Pago Segura: Descontar Saldo PRIMERO, Despachar DESPUÉS**:
   * **Antes** de pedirle a la transportadora (ej. LAAR Courier) que genere la guía, el ERP verifica y reserva el saldo disponible en la billetera.
   * Si la tienda no tiene saldo suficiente, **el paquete NUNCA sale ni se registra con la transportadora**.
   * Si la transportadora presenta una falla técnica al generar la guía, **el sistema devuelve automáticamente el dinero retenido a la billetera**.

---

## 🔄 4. Ciclo de Vida de una Solicitud de Retiro de Fondos

El proceso de retiro de dinero hacia la cuenta bancaria de la tienda sigue este flujo:

```
[ 1. Tienda solicita retiro ] ──► [ Dinero pasa de Disponible a Bloqueado ]
                                                   │
                                     (2. Revisión de Administrador)
                                      ┌────────────┴────────────┐
                                      ▼                         ▼
                              [ Si es Aprobado ]       [ Si es Rechazado ]
                                      │                         │
                        [ Salida definitiva a banco ]   [ Fondos se desbloquean ]
                                      │                         │
                        [ Registro EGRESO en historial ] [ Dinero regresa a Disponible ]
```

1. **Solicitud de Retiro**: La tienda elige una de sus cuentas bancarias registradas e ingresa el monto deseado. El dinero se resta de *Disponible* y pasa a *Bloqueado*.
2. **Aprobación de la Administración**: Un usuario SuperAdmin revisa los datos bancarios y realiza la transferencia.
   * **Si se Aprueba**: El dinero bloqueado se consolida y se emite la constancia de pago.
   * **Si se Rechaza**: El dinero retenido regresa automáticamente al *Saldo Disponible* de la tienda y se explica el motivo del rechazo en el historial.

---

## 📜 5. Historial de Movimientos y Reglas Contables

Cada vez que entra o sale dinero **REAL** de la billetera, el sistema guarda una línea imborrable en el historial de movimientos.

### 🔍 Trazabilidad "Antes y Después"
Cada movimiento en el historial registra:
* **Monto**: La cantidad que ingresó (+) o salió (-).
* **Saldo Antes**: Cuánto dinero real había en la billetera justo antes de la transacción.
* **Saldo Después**: Cuánto dinero real quedó en la billetera justo después de la transacción.
* **Descripción y Referencia**: El motivo (ej. *"Pago de flete guía TRJ123"*, *"Recaudo COD liquidado guía TRJ456"*) y el ID del objeto que originó el cambio.

---

## 🚦 6. Resumen de Entradas, Salidas y Exclusiones

| Tipo | Evento de Negocio | ¿Genera línea en Historial? | Impacto en Billetera |
| :--- | :--- | :---: | :--- |
| 🟢 **Ingreso** | Entrega exitosa de pedido COD | **SÍ** | Pasa de *Pendiente* a *Saldo Disponible* (+) |
| 🟢 **Ingreso** | Recarga bancaria aprobada por Admin | **SÍ** | Incrementa el *Saldo Disponible* (+) |
| 🟢 **Ingreso** | Solicitud de retiro rechazada por Admin | **SÍ** | Regresa el dinero de *Bloqueado* a *Disponible* (+) |
| 🟢 **Ingreso** | Abono de comisiones por red de referidos | **SÍ** | Incrementa el *Saldo Disponible* (+) |
| 🔴 **Egreso** | Generación de envío prepagado (flete directo) | **SÍ** | Descuenta del *Saldo Disponible* (-) |
| 🔴 **Egreso** | Retiro de fondos aprobado por Admin | **SÍ** | Consolida la salida definitiva del dinero (-) |
| 🔴 **Egreso** | Ajuste o cobro administrativo en contra | **SÍ** | Descuenta del *Saldo Disponible* (-) |
| ⚪ **Sin Movimiento** | Paquete COD pasa a "En Tránsito" o "Zona de Entrega" | **NO** | Solo actualiza la proyección de *Saldo Pendiente* |
| ⚪ **Sin Movimiento** | La tienda presiona "Solicitar Retiro" | **NO** | Solo mueve el dinero a *Saldo Bloqueado* (el movimiento contable sale al ser aprobado/rechazado) |

---

> **Base de Auditoría**: Gracias al registro de *Saldo Antes* y *Saldo Después* en cada transacción, el sistema puede verificar matemáticamente en cualquier momento que la suma de todo el historial coincide exactamente con el saldo actual de la tienda.
