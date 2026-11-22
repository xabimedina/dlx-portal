import { describe, expect, it } from "vitest";
import {
  buildClientActions,
  isNoOpStudioText,
  isConfirmedMeeting,
  textsMatch,
} from "./actions-aggregator";

describe("buildClientActions", () => {
  it("agrega decisiones pendientes ordenadas por prioridad → due_date", () => {
    const { actions } = buildClientActions({
      decisions: [
        { id: "d1", title: "Suelo", status: "Pendiente", priority: "Media", due_date: "2026-06-01", created_at: "a" },
        { id: "d2", title: "Campana", status: "Pendiente", priority: "Urgente", due_date: "2026-06-10", created_at: "b", studio_recommendation: "La de techo" },
        { id: "d3", title: "Pintura", status: "Pendiente", priority: "Urgente", due_date: "2026-06-03", created_at: "c" },
      ],
      today: "2026-05-20",
    });
    expect(actions.map((a) => a.key)).toEqual(["dec-d3", "dec-d2", "dec-d1"]);
    expect(actions[1]).toMatchObject({
      verb: "Decidir",
      urgent: true,
      hasRecommendation: true,
      origin: "antes del 10 de junio · hay recomendación del estudio",
      section: "decisions",
    });
  });

  it("las decisiones «En revisión» y «Votado» NO desaparecen: van a «En manos del estudio» traducidas", () => {
    const { actions, studio } = buildClientActions({
      decisions: [
        { id: "d1", title: "Encimera", status: "En revisión" },
        { id: "d2", title: "Grifería", status: "Votado" },
      ],
    });
    expect(actions).toHaveLength(0);
    expect(studio.map((s) => s.text)).toEqual([
      "Encimera · pediste una revisión — esperando respuesta del estudio",
      "Grifería · tu elección está registrada — el estudio la confirma en breve",
    ]);
  });

  it("fases «Pendiente de revisión cliente» → Revisar", () => {
    const { actions } = buildClientActions({
      phases: [
        { id: "f4", phase_number: "Fase 4", name: "Baños", status: "Pendiente de revisión cliente", order_index: 4 },
        { id: "f1", phase_number: "Fase 1", name: "Distribución", status: "Finalizada", order_index: 1 },
      ],
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      verb: "Revisar",
      title: "Revisa la Fase 4: Baños",
      section: "phases",
    });
  });

  it("solo el acta confirmada MÁS RECIENTE con client_tasks; las borrador no existen", () => {
    const { actions } = buildClientActions({
      meetings: [
        { id: "m1", meeting_date: "2026-06-01", client_tasks: "Firmar acta de replanteo", status: "confirmada" },
        { id: "m2", meeting_date: "2026-07-01", client_tasks: "Elegir parquet" }, // sin status = confirmada
        { id: "m3", meeting_date: "2026-07-10", client_tasks: "Tarea fantasma", status: "borrador" },
      ],
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      verb: "Ver acta",
      title: "Elegir parquet",
      origin: "Acordado en la reunión del 1 de julio",
      section: "meetings",
    });
  });

  it("decisions_needed del ÚLTIMO parte por week_number (no por orden del array)", () => {
    const { actions } = buildClientActions({
      weeklyUpdates: [
        { id: "w1", week_number: 1, decisions_needed: "Decisión vieja" },
        { id: "w6", week_number: 6, decisions_needed: "Confirmar el color de la puerta" },
        { id: "w3", week_number: 3, decisions_needed: "Otra vieja" },
      ],
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      verb: "Responder",
      title: "Confirmar el color de la puerta",
      origin: "Del parte de la Semana 6",
    });
  });

  it("dedupe: si el parte repite una decisión formal ya listada, no se duplica", () => {
    const { actions } = buildClientActions({
      decisions: [
        { id: "d1", title: "Color de Pintura en el Salón Comedor", status: "Pendiente", priority: "Urgente", due_date: "2026-08-05" },
      ],
      weeklyUpdates: [
        {
          id: "w6",
          week_number: 6,
          decisions_needed:
            "URGENTE decidir el color de pintura lisa mate para el salón (Blanco Lino vs Gris Bruma) antes del inicio de pintura.",
        },
      ],
    });
    expect(actions).toHaveLength(1);
    expect(actions[0].verb).toBe("Decidir");
  });

  it("un decisions_needed distinto de las decisiones formales SÍ se añade", () => {
    const { actions } = buildClientActions({
      decisions: [
        { id: "d1", title: "Campana extractora", status: "Pendiente" },
      ],
      weeklyUpdates: [
        { id: "w4", week_number: 4, decisions_needed: "Confirmar la compra de los sanitarios empotrados" },
      ],
    });
    expect(actions.map((a) => a.verb)).toEqual(["Decidir", "Responder"]);
  });

  it("«Ninguna decisión requerida…» no genera acción", () => {
    const { actions } = buildClientActions({
      weeklyUpdates: [
        { id: "w1", week_number: 1, decisions_needed: "Ninguna decisión requerida en esta semana de inicio." },
      ],
    });
    expect(actions).toHaveLength(0);
  });

  it("solicitudes pendientes → «En manos del estudio» con categoría en minúscula", () => {
    const { studio } = buildClientActions({
      requests: [
        { id: "r1", category: "Consulta", status: "Pendiente", created_at: "2026-05-28T10:15:00Z" },
        { id: "r2", category: "Revisión", status: "Atendida", created_at: "2026-05-20T17:40:00Z" },
      ],
    });
    expect(studio).toHaveLength(1);
    expect(studio[0].text).toBe("Tu consulta del 28 de mayo — pendiente de respuesta");
  });
});

describe("isNoOpStudioText", () => {
  it("detecta textos que dicen «nada»", () => {
    expect(isNoOpStudioText("Ninguna incidencia en los enlucidos.")).toBe(true);
    expect(isNoOpStudioText("Sin incidencias críticas de instalaciones.")).toBe(true);
    expect(isNoOpStudioText("No hay decisiones pendientes")).toBe(true);
    expect(isNoOpStudioText("")).toBe(true);
    expect(isNoOpStudioText(null)).toBe(true);
  });

  it("no filtra contenido real", () => {
    expect(isNoOpStudioText("Se detectó que un pilar interfería con el encendido")).toBe(false);
    expect(isNoOpStudioText("Confirmar la compra de los sanitarios")).toBe(false);
  });
});

describe("isConfirmedMeeting", () => {
  it("las actas antiguas sin status se consideran confirmadas", () => {
    expect(isConfirmedMeeting({})).toBe(true);
    expect(isConfirmedMeeting({ status: "confirmada" })).toBe(true);
    expect(isConfirmedMeeting({ status: "borrador" })).toBe(false);
  });
});

describe("textsMatch", () => {
  it("coincide por solapamiento de palabras significativas, con acentos", () => {
    expect(
      textsMatch(
        "Color de Pintura en el Salón Comedor",
        "URGENTE decidir el color de pintura lisa mate para el salón antes del inicio"
      )
    ).toBe(true);
  });

  it("no coincide con textos de otro tema", () => {
    expect(
      textsMatch("Campana extractora de techo", "Confirmar la compra de los sanitarios empotrados")
    ).toBe(false);
  });

  it("un plazo vencido no dice «antes del…»: dice cuándo era y es urgente", () => {
    const { actions } = buildClientActions({
      decisions: [{ id: "d1", title: "Grifería", status: "Pendiente", priority: "Media", due_date: "2026-11-09", created_at: "a" }],
      today: "2026-11-20",
    });
    expect(actions[0]).toMatchObject({ origin: "el plazo era el 9 de noviembre", urgent: true });
  });
});
