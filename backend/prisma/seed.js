import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Rotación clásica de planta: 2 mañanas, 2 tardes, 2 noches, 2 libres
const ROTATION = ['M', 'M', 'T', 'T', 'N', 'N', null, null];

const STAFF = [
  { name: 'Lucía Fernández', email: 'lucia@hospital.test', position: 'Enfermería' },
  { name: 'Marcos Gil', email: 'marcos@hospital.test', position: 'Enfermería' },
  { name: 'Ana Torres', email: 'ana@hospital.test', position: 'Enfermería' },
  { name: 'Javier Ruiz', email: 'javier@hospital.test', position: 'Enfermería' },
  { name: 'Carmen López', email: 'carmen@hospital.test', position: 'TCAE' },
  { name: 'David Moreno', email: 'david@hospital.test', position: 'TCAE' },
];

async function main() {
  await prisma.notification.deleteMany();
  await prisma.absence.deleteMany();
  await prisma.swapRequest.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.user.deleteMany();
  await prisma.unit.deleteMany();

  const unit = await prisma.unit.create({ data: { name: 'Planta 3 · Medicina Interna' } });
  const passwordHash = await bcrypt.hash('turnos123', 10);

  await prisma.user.create({
    data: {
      name: 'Elena Navarro',
      email: 'supervisora@hospital.test',
      position: 'Supervisora de planta',
      role: 'SUPERVISOR',
      passwordHash,
      unitId: unit.id,
    },
  });

  const staff = [];
  for (const s of STAFF) {
    staff.push(await prisma.user.create({ data: { ...s, role: 'STAFF', passwordHash, unitId: unit.id } }));
  }

  // Turnos desde el día 1 del mes actual hasta el final del mes siguiente
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  const shifts = [];
  for (let d = new Date(start), day = 0; d <= end; d.setDate(d.getDate() + 1), day++) {
    staff.forEach((user, i) => {
      // Desfase de 3 días entre personas para que cada turno quede cubierto
      const type = ROTATION[(day + i * 3) % ROTATION.length];
      if (type) shifts.push({ date: fmt(d), type, userId: user.id, unitId: unit.id });
    });
  }
  await prisma.shift.createMany({ data: shifts });

  console.log(`Seed completado: 1 supervisora, ${staff.length} sanitarios, ${shifts.length} turnos`);
  console.log('Contraseña de todos los usuarios: turnos123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
