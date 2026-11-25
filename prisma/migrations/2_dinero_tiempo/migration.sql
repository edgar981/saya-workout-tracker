-- CreateTable
CREATE TABLE "Cuenta" (
    "id" UUID NOT NULL,
    "banco" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ultimos4" TEXT,
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cuenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaldoCuenta" (
    "id" UUID NOT NULL,
    "cuenta_id" UUID NOT NULL,
    "valor" BIGINT NOT NULL,
    "anotado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaldoCuenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deuda" (
    "id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "con_quien" TEXT NOT NULL,
    "tasa_ea" DECIMAL(5,2),
    "cuota" BIGINT,
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cupo" BIGINT,
    "monto_inicial" BIGINT,
    "ultimos4" TEXT,
    "cuotas_total" INTEGER,
    "dia_pago" INTEGER,
    "primera_cuota" DATE,

    CONSTRAINT "Deuda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaldoDeuda" (
    "id" UUID NOT NULL,
    "deuda_id" UUID NOT NULL,
    "valor" BIGINT NOT NULL,
    "anotado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaldoDeuda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Extracto" (
    "id" UUID NOT NULL,
    "deuda_id" UUID NOT NULL,
    "cierre" DATE NOT NULL,
    "intereses" BIGINT NOT NULL,
    "pago_minimo" BIGINT,
    "fecha_limite" DATE,
    "anotado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Extracto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tema" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroTiempo" (
    "id" UUID NOT NULL,
    "tema_id" UUID NOT NULL,
    "minutos" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "anotado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroTiempo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SaldoCuenta_cuenta_id_anotado_en_idx" ON "SaldoCuenta"("cuenta_id", "anotado_en");

-- CreateIndex
CREATE INDEX "SaldoDeuda_deuda_id_anotado_en_idx" ON "SaldoDeuda"("deuda_id", "anotado_en");

-- CreateIndex
CREATE INDEX "Extracto_deuda_id_cierre_idx" ON "Extracto"("deuda_id", "cierre");

-- CreateIndex
CREATE UNIQUE INDEX "Tema_nombre_key" ON "Tema"("nombre");

-- CreateIndex
CREATE INDEX "RegistroTiempo_fecha_idx" ON "RegistroTiempo"("fecha");

-- AddForeignKey
ALTER TABLE "SaldoCuenta" ADD CONSTRAINT "SaldoCuenta_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaldoDeuda" ADD CONSTRAINT "SaldoDeuda_deuda_id_fkey" FOREIGN KEY ("deuda_id") REFERENCES "Deuda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Extracto" ADD CONSTRAINT "Extracto_deuda_id_fkey" FOREIGN KEY ("deuda_id") REFERENCES "Deuda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroTiempo" ADD CONSTRAINT "RegistroTiempo_tema_id_fkey" FOREIGN KEY ("tema_id") REFERENCES "Tema"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
