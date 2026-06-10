import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useSession } from "../../app/providers/SessionProvider";
import { api, apiRequest } from "../../shared/api/client";
import {
  AlertCircleIcon,
  BellIcon,
  BookIcon,
  BoxIcon,
  CalendarIcon,
  ChecklistIcon,
  ChevronRightIcon,
  ClipboardIcon,
  ClockIcon,
  LogoutIcon,
  MoreIcon,
  OverviewIcon,
  PlusIcon,
  SearchIcon,
  TeamIcon,
} from "../../shared/ui/Icon";
import "./EmployeeStartPage.css";

type MobileTab = "overview" | "tasks" | "request" | "checklists" | "hallPlan" | "more";

type OverviewCard = {
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  action: string;
  tone: "orange" | "blue" | "green" | "purple";
  icon: ReactNode;
  badge?: string;
};


type HallStatus = "free" | "reserved" | "arrived" | "occupied" | "disabled";
type HallMode = "tables" | "bookings";
type HallFilter = "all" | HallStatus;

type MobileHall = {
  id: string;
  name: string;
  tablesCount: number;
};

type MobileBooking = {
  id: string;
  guestName: string;
  phone: string;
  time: string;
  guestsCount: number;
  status: "new" | "confirmed" | "arrived" | "seated" | "cancelled" | "no_show";
  comment?: string;
};

type MobileHallTable = {
  id: string;
  hallId: string;
  name: string;
  seats: number;
  status: HallStatus;
  booking?: MobileBooking;
};

const fallbackHalls: MobileHall[] = [
  { id: "main", name: "Основной зал", tablesCount: 12 },
  { id: "terrace", name: "Терраса", tablesCount: 8 },
  { id: "vip", name: "VIP", tablesCount: 4 },
  { id: "bar", name: "Бар", tablesCount: 6 },
];

const fallbackHallTables: MobileHallTable[] = [
  { id: "t1", hallId: "main", name: "Стол 1", seats: 2, status: "free" },
  {
    id: "t4",
    hallId: "main",
    name: "Стол 4",
    seats: 4,
    status: "reserved",
    booking: {
      id: "b4",
      guestName: "Анна Смирнова",
      phone: "+7 999 123-45-67",
      time: "19:00",
      guestsCount: 4,
      status: "confirmed",
      comment: "День рождения",
    },
  },
  {
    id: "t6",
    hallId: "main",
    name: "Стол 6",
    seats: 4,
    status: "arrived",
    booking: {
      id: "b6",
      guestName: "Иван Петров",
      phone: "+7 900 111-22-33",
      time: "18:30",
      guestsCount: 3,
      status: "arrived",
      comment: "Попросили стол у окна",
    },
  },
  { id: "t7", hallId: "main", name: "Стол 7", seats: 2, status: "free" },
  {
    id: "t8",
    hallId: "main",
    name: "Стол 8",
    seats: 6,
    status: "occupied",
    booking: {
      id: "b8",
      guestName: "Семья Орловых",
      phone: "+7 900 222-44-55",
      time: "19:15",
      guestsCount: 6,
      status: "seated",
      comment: "Нужен детский стул",
    },
  },
  { id: "t9", hallId: "main", name: "Стол 9", seats: 4, status: "free" },
  { id: "t10", hallId: "main", name: "Стол 10", seats: 4, status: "disabled" },
  { id: "t11", hallId: "main", name: "Стол 11", seats: 2, status: "free" },
  { id: "t12", hallId: "main", name: "Стол 12", seats: 4, status: "free" },
  { id: "tr1", hallId: "terrace", name: "Терраса 1", seats: 4, status: "free" },
  { id: "tr2", hallId: "terrace", name: "Терраса 2", seats: 2, status: "reserved", booking: { id: "bt2", guestName: "Ольга Соколова", phone: "+7 900 555-12-12", time: "20:00", guestsCount: 2, status: "confirmed" } },
  { id: "vip1", hallId: "vip", name: "VIP 1", seats: 8, status: "reserved", booking: { id: "bv1", guestName: "Компания на 8 гостей", phone: "+7 900 777-70-70", time: "21:00", guestsCount: 8, status: "confirmed", comment: "Предзаказ по меню" } },
  { id: "bar1", hallId: "bar", name: "Бар 1", seats: 2, status: "free" },
];

function getHallStatusLabel(status: HallStatus) {
  const labels: Record<HallStatus, string> = {
    free: "Свободен",
    reserved: "Подтверждена",
    arrived: "Пришли по брони",
    occupied: "Гости сели",
    disabled: "Недоступен",
  };
  return labels[status];
}

function getBookingStatusLabel(status: MobileBooking["status"]) {
  const labels: Record<MobileBooking["status"], string> = {
    new: "Новая",
    confirmed: "Подтверждена",
    arrived: "Пришли по брони",
    seated: "Гости сели",
    cancelled: "Отменена",
    no_show: "Не пришли",
  };
  return labels[status];
}

export function EmployeeStartPage() {
  const { session, logout } = useSession();
  const [activeTab, setActiveTab] = useState<MobileTab>("overview");
  const [shiftOpen, setShiftOpen] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [halls, setHalls] = useState<MobileHall[]>(fallbackHalls);
  const [hallTables, setHallTables] = useState<MobileHallTable[]>(fallbackHallTables);
  const [selectedHallId, setSelectedHallId] = useState<string>(fallbackHalls[0].id);
  const [hallMode, setHallMode] = useState<HallMode>("tables");
  const [hallFilter, setHallFilter] = useState<HallFilter>("all");
  const [selectedTable, setSelectedTable] = useState<MobileHallTable | null>(null);


  async function loadHallPlan() {
    try {
      const result = await apiRequest<{ halls: Array<{ id: string; name: string; tablesCount?: number }>; tables: Array<{ id: string; hallId: string; name: string; seats: number; status: HallStatus }>; bookings: Array<{ id: string; tableId: string; guestName: string; phone?: string; time: string; guestsCount: number; status: MobileBooking["status"]; comment?: string }> }>("/api/mobile/hall-plan");
      const nextTables = result.tables.map((table) => {
        const booking = result.bookings.find((item) => item.tableId === table.id && !["cancelled", "no_show"].includes(item.status));
        return { ...table, booking: booking ? { ...booking, phone: booking.phone || "", comment: booking.comment || "" } : undefined };
      });
      setHalls(result.halls.map((hall) => ({ id: hall.id, name: hall.name, tablesCount: hall.tablesCount || nextTables.filter((table) => table.hallId === hall.id).length })));
      setHallTables(nextTables);
      if (result.halls[0] && !result.halls.some((hall) => hall.id === selectedHallId)) setSelectedHallId(result.halls[0].id);
    } catch {
      setHalls(fallbackHalls);
      setHallTables(fallbackHallTables);
    }
  }

  useEffect(() => { void loadHallPlan() }, []);

  async function updateSelectedBookingStatus(status: MobileBooking["status"]) {
    if (!selectedTable?.booking) return;
    await api.bookingStatus(selectedTable.booking.id, status);
    await loadHallPlan();
    setSelectedTable(null);
  }

  const employee = {
    name: session?.user.name || "Мария",
    position: "Администратор",
    restaurantName: session?.restaurant.name || "Resto Control",
    canSeeHallPlan: true,
    canManageStopList: false,
    inventoryAssignment: null as null | { title: string; dueTime: string },
  };

  const overviewCards = useMemo<OverviewCard[]>(() => {
    const cards: OverviewCard[] = [
      {
        id: "checklist",
        title: "Чек-лист открытия",
        subtitle: "5 из 12 пунктов",
        meta: "до 11:00",
        action: "Продолжить",
        tone: "orange",
        icon: <ChecklistIcon />,
      },
      {
        id: "tasks",
        title: "Задачи",
        subtitle: "3 активные",
        meta: "1 просрочена",
        action: "Открыть",
        tone: "blue",
        icon: <ClipboardIcon />,
      },
    ];

    if (employee.inventoryAssignment) {
      cards.push({
        id: "inventory",
        title: "Инвентаризация",
        subtitle: employee.inventoryAssignment.title,
        meta: `сдать до ${employee.inventoryAssignment.dueTime}`,
        action: "Начать",
        tone: "green",
        icon: <BoxIcon />,
      });
    }

    if (employee.canManageStopList) {
      cards.push({
        id: "stoplist",
        title: "Стоп-лист",
        subtitle: "7 позиций",
        action: "Открыть",
        tone: "purple",
        icon: <AlertCircleIcon />,
        badge: "для старших",
      });
    }

    if (employee.canSeeHallPlan) {
      cards.push({
        id: "hallplan",
        title: "План зала",
        subtitle: "14 броней сегодня",
        action: "Открыть",
        tone: "green",
        icon: <CalendarIcon />,
      });
    }

    return cards;
  }, [
    employee.canManageStopList,
    employee.canSeeHallPlan,
    employee.inventoryAssignment,
  ]);

  const tasks = [
    {
      title: "Подготовить зону ожидания гостей",
      status: "к 10:30",
      accent: "normal",
    },
    {
      title: "Проверить резерв на вечер",
      status: "до 17:00",
      accent: "normal",
    },
    {
      title: "Протереть столы на террасе",
      status: "просрочена 15 мин назад",
      accent: "danger",
    },
  ];

  const checklists = [
    { title: "Открытие зала", progress: "5 / 12", time: "до 11:00" },
    { title: "Подготовка входной зоны", progress: "2 / 6", time: "до 10:00" },
    { title: "Закрытие смены", progress: "0 / 10", time: "после 22:30" },
  ];

  const moreTiles = [
    "Знакомство с компанией",
    "Корпоративная жизнь",
    "Постоянные гости",
    "База знаний",
    "Поддержка",
  ];

  const selectedHall = halls.find((hall) => hall.id === selectedHallId) ?? halls[0];
  const visibleHallTables = hallTables.filter((table) => {
    if (table.hallId !== selectedHallId) return false;
    if (hallFilter === "all") return true;
    return table.status === hallFilter;
  });
  const visibleBookings = visibleHallTables.filter((table) => table.booking).sort((a, b) => String(a.booking?.time).localeCompare(String(b.booking?.time)));

  function handleOverviewAction(cardId: string) {
    if (cardId === "hallplan") {
      setActiveTab("hallPlan");
      return;
    }
    if (cardId === "tasks") {
      setActiveTab("tasks");
      return;
    }
    if (cardId === "checklist") {
      setActiveTab("checklists");
    }
  }

  function renderOverview() {
    return (
      <>
        <section className="employee-mobile__shift-card">
          <div className="employee-mobile__shift-status">
            <div
              className={
                shiftOpen
                  ? "employee-mobile__shift-icon employee-mobile__shift-icon--open"
                  : "employee-mobile__shift-icon"
              }
            >
              <ClockIcon />
            </div>
            <div>
              <strong>
                {shiftOpen ? "Смена открыта" : "Смена не открыта"}
              </strong>
              <span>
                {shiftOpen
                  ? "сегодня с 09:42"
                  : "Сначала откройте смену, чтобы начать работу"}
              </span>
            </div>
          </div>
          <div className="employee-mobile__shift-meta">
            <strong>{shiftOpen ? "до 23:00" : "—"}</strong>
            <span>{shiftOpen ? "8 ч 18 мин" : "смена не начата"}</span>
          </div>
          <button
            className={
              shiftOpen
                ? "employee-mobile__shift-button"
                : "employee-mobile__shift-button employee-mobile__shift-button--primary"
            }
            type="button"
            onClick={() => setShiftOpen((value) => !value)}
          >
            {shiftOpen ? "Закрыть смену" : "Открыть смену"}
          </button>
        </section>

        <section className="employee-mobile__section">
          <div className="employee-mobile__section-title">
            <h2>Что нужно сделать</h2>
          </div>
          <div className="employee-mobile__card-list">
            {overviewCards.map((card) => (
              <article
                key={card.id}
                className={`employee-mobile__work-card employee-mobile__work-card--${card.tone}`}
              >
                <div className="employee-mobile__work-icon">{card.icon}</div>
                <div className="employee-mobile__work-content">
                  <div className="employee-mobile__work-heading">
                    <strong>{card.title}</strong>
                    {card.badge ? <span>{card.badge}</span> : null}
                  </div>
                  <p>{card.subtitle}</p>
                  {card.meta ? <small>{card.meta}</small> : null}
                </div>
                <button type="button" onClick={() => handleOverviewAction(card.id)}>{card.action}</button>
                <span className="employee-mobile__work-arrow">
                  <ChevronRightIcon />
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="employee-mobile__section">
          <div className="employee-mobile__section-title">
            <h2>Срочные уведомления</h2>
            <button type="button" onClick={() => setShowNotifications(true)}>
              Все
            </button>
          </div>
          <article className="employee-mobile__alert-card">
            <div className="employee-mobile__alert-icon">
              <AlertCircleIcon />
            </div>
            <div className="employee-mobile__alert-content">
              <strong>Задача «Протереть столы на террасе»</strong>
              <span>просрочена 15 мин назад</span>
            </div>
            <ChevronRightIcon />
          </article>
        </section>
      </>
    );
  }

  function renderTasks() {
    return (
      <section className="employee-mobile__section employee-mobile__section--tight">
        <div className="employee-mobile__section-title">
          <h2>Мои задачи</h2>
        </div>
        <div className="employee-mobile__plain-list">
          {tasks.map((task) => (
            <article key={task.title} className="employee-mobile__list-card">
              <div>
                <strong>{task.title}</strong>
                <p
                  className={
                    task.accent === "danger" ? "employee-mobile__danger" : ""
                  }
                >
                  {task.status}
                </p>
              </div>
              <button type="button">Открыть</button>
            </article>
          ))}
        </div>
      </section>
    );
  }

  function renderChecklists() {
    return (
      <section className="employee-mobile__section employee-mobile__section--tight">
        <div className="employee-mobile__section-title">
          <h2>Чек-листы</h2>
        </div>
        <div className="employee-mobile__plain-list">
          {checklists.map((item) => (
            <article key={item.title} className="employee-mobile__list-card">
              <div>
                <strong>{item.title}</strong>
                <p>{item.progress}</p>
                <small>{item.time}</small>
              </div>
              <button type="button">Открыть</button>
            </article>
          ))}
        </div>
      </section>
    );
  }



  function renderHallPlan() {
    const filters: Array<{ value: HallFilter; label: string }> = [
      { value: "all", label: "Все" },
      { value: "free", label: "Свободные" },
      { value: "reserved", label: "Забронированные" },
      { value: "arrived", label: "Пришли" },
      { value: "occupied", label: "Сели" },
    ];

    return (
      <section className="employee-mobile__hall-page">
        <div className="employee-mobile__hall-header">
          <div>
            <button type="button" onClick={() => setActiveTab("overview")}>← Обзор</button>
            <h2>План зала</h2>
            <p>Сегодня, 15 июня</p>
          </div>
          <button type="button" className="employee-mobile__hall-search" aria-label="Поиск">
            <SearchIcon />
          </button>
        </div>

        <div className="employee-mobile__hall-tabs" aria-label="Залы">
          {halls.map((hall) => (
            <button
              type="button"
              key={hall.id}
              className={hall.id === selectedHallId ? "is-active" : ""}
              onClick={() => {
                setSelectedHallId(hall.id);
                setHallFilter("all");
                setSelectedTable(null);
              }}
            >
              <strong>{hall.name}</strong>
              <span>{hall.tablesCount} столов</span>
            </button>
          ))}
        </div>

        <div className="employee-mobile__hall-mode" aria-label="Режим плана зала">
          <button type="button" className={hallMode === "tables" ? "is-active" : ""} onClick={() => setHallMode("tables")}>Столы</button>
          <button type="button" className={hallMode === "bookings" ? "is-active" : ""} onClick={() => setHallMode("bookings")}>Брони</button>
        </div>

        <div className="employee-mobile__hall-filters" aria-label="Фильтр столов">
          {filters.map((filter) => (
            <button
              type="button"
              key={filter.value}
              className={hallFilter === filter.value ? "is-active" : ""}
              onClick={() => setHallFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {hallMode === "tables" ? (
          <div className="employee-mobile__hall-grid">
            {visibleHallTables.map((table) => (
              <button
                type="button"
                key={table.id}
                className={`employee-mobile__table-card employee-mobile__table-card--${table.status}`}
                onClick={() => setSelectedTable(table)}
              >
                <div>
                  <strong>{table.name}</strong>
                  <span>{table.seats} места</span>
                </div>
                {table.booking ? <p>{table.booking.time} · {table.booking.guestName}</p> : <p>&nbsp;</p>}
                <small>{getHallStatusLabel(table.status)}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="employee-mobile__booking-list">
            {visibleBookings.map((table) => (
              <button type="button" key={table.id} onClick={() => setSelectedTable(table)}>
                <time>{table.booking?.time}</time>
                <div>
                  <strong>{table.booking?.guestName}</strong>
                  <span>{table.name} · {table.booking?.guestsCount} гостя</span>
                </div>
                <small className={`employee-mobile__booking-status employee-mobile__booking-status--${table.status}`}>{table.booking ? getBookingStatusLabel(table.booking.status) : getHallStatusLabel(table.status)}</small>
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  function renderMore() {
    return (
      <section className="employee-mobile__section employee-mobile__section--tight">
        <div className="employee-mobile__section-title">
          <h2>Ещё</h2>
        </div>
        <div className="employee-mobile__plain-list">
          {moreTiles.map((item) => (
            <article
              key={item}
              className="employee-mobile__list-card employee-mobile__list-card--chevron"
            >
              <div>
                <strong>{item}</strong>
                <p>Открыть раздел</p>
              </div>
              <ChevronRightIcon />
            </article>
          ))}
          <button
            className="employee-mobile__logout-row"
            type="button"
            onClick={logout}
          >
            <LogoutIcon />
            <span>Выйти</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <main className="employee-mobile">
      <header className="employee-mobile__header">
        <div>
          <h1>Доброе утро, {employee.name}!</h1>
          <p>
            {employee.position} · {employee.restaurantName}
          </p>
        </div>
        <div className="employee-mobile__header-actions">
          <button
            type="button"
            onClick={() => setShowNotifications(true)}
            aria-label="Уведомления"
          >
            <BellIcon />
            <b>3</b>
          </button>
        </div>
      </header>

      <section className="employee-mobile__content">
        {activeTab === "overview" && renderOverview()}
        {activeTab === "tasks" && renderTasks()}
        {activeTab === "checklists" && renderChecklists()}
        {activeTab === "hallPlan" && renderHallPlan()}
        {activeTab === "more" && renderMore()}
      </section>

      <nav className="employee-mobile__bottom-nav" aria-label="Нижнее меню">
        <button
          type="button"
          className={activeTab === "overview" ? "is-active" : ""}
          onClick={() => setActiveTab("overview")}
        >
          <OverviewIcon />
          <span>Обзор</span>
        </button>
        <button
          type="button"
          className={activeTab === "tasks" ? "is-active" : ""}
          onClick={() => setActiveTab("tasks")}
        >
          <ClipboardIcon />
          <span>Задачи</span>
        </button>
        <button
          type="button"
          className="employee-mobile__plus-button"
          onClick={() => setShowRequestModal(true)}
        >
          <span>
            <PlusIcon />
          </span>
          <strong>Тех. заявка</strong>
        </button>
        <button
          type="button"
          className={activeTab === "checklists" ? "is-active" : ""}
          onClick={() => setActiveTab("checklists")}
        >
          <ChecklistIcon />
          <span>Чек-листы</span>
        </button>
        <button
          type="button"
          className={activeTab === "more" ? "is-active" : ""}
          onClick={() => setActiveTab("more")}
        >
          <MoreIcon />
          <span>Ещё</span>
        </button>
      </nav>


      {selectedTable ? (
        <div
          className="employee-mobile__sheet-backdrop"
          onClick={() => setSelectedTable(null)}
        >
          <div
            className="employee-mobile__sheet employee-mobile__hall-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="employee-mobile__sheet-handle" />
            <div className="employee-mobile__hall-sheet-title">
              <div>
                <strong>{selectedTable.name}</strong>
                <p>{selectedHall.name} · {selectedTable.seats} места</p>
              </div>
              <button type="button" onClick={() => setSelectedTable(null)}>×</button>
            </div>

            {selectedTable.booking ? (
              <div className="employee-mobile__booking-card">
                <small>Бронь на сегодня</small>
                <strong>{selectedTable.booking.guestName}</strong>
                <p>{selectedTable.booking.time} · {selectedTable.booking.guestsCount} гостя</p>
                <span>Телефон: {selectedTable.booking.phone}</span>
                {selectedTable.booking.comment ? <span>Комментарий: {selectedTable.booking.comment}</span> : null}
              </div>
            ) : (
              <div className="employee-mobile__booking-card">
                <small>Бронь на сегодня</small>
                <strong>Брони нет</strong>
                <p>{selectedTable.status === "disabled" ? "Стол недоступен" : "Стол свободен для посадки"}</p>
              </div>
            )}

            <div className="employee-mobile__hall-actions">
              <button type="button" className="employee-mobile__hall-actions-blue" onClick={() => updateSelectedBookingStatus("arrived")}>Пришли по брони</button>
              <button type="button" className="employee-mobile__hall-actions-purple" onClick={() => updateSelectedBookingStatus("seated")}>Гости сели</button>
              <button type="button" className="employee-mobile__hall-actions-green" onClick={() => updateSelectedBookingStatus("cancelled")}>Освободить стол</button>
              <button type="button" onClick={() => { if (selectedTable?.booking?.phone) window.location.href = `tel:${selectedTable.booking.phone}` }}>Позвонить</button>
              <button type="button" onClick={() => updateSelectedBookingStatus("no_show")}>Не пришли</button>
              <button type="button" className="employee-mobile__hall-actions-red" onClick={() => updateSelectedBookingStatus("cancelled")}>Отменить бронь</button>
            </div>
          </div>
        </div>
      ) : null}

      {showNotifications ? (
        <div
          className="employee-mobile__sheet-backdrop"
          onClick={() => setShowNotifications(false)}
        >
          <div
            className="employee-mobile__sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="employee-mobile__sheet-handle" />
            <div className="employee-mobile__sheet-title">
              <strong>Уведомления</strong>
              <p>Важные события по смене</p>
            </div>
            <div className="employee-mobile__notification-list">
              <article>
                <strong>Задача «Протереть столы на террасе»</strong>
                <span>просрочена 15 мин назад</span>
              </article>
              <article>
                <strong>Напоминание по брони</strong>
                <span>Стол у окна на 19:00 подтверждён</span>
              </article>
              <article>
                <strong>Чек-лист открытия</strong>
                <span>Осталось выполнить 7 пунктов</span>
              </article>
            </div>
          </div>
        </div>
      ) : null}

      {showRequestModal ? (
        <div
          className="employee-mobile__sheet-backdrop"
          onClick={() => setShowRequestModal(false)}
        >
          <div
            className="employee-mobile__sheet employee-mobile__sheet--form"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="employee-mobile__sheet-handle" />
            <div className="employee-mobile__sheet-title">
              <strong>Новая тех. заявка</strong>
              <p>Сообщите о проблеме по оборудованию или расходникам</p>
            </div>
            {requestSubmitted ? (
              <div className="employee-mobile__request-success">
                <strong>Заявка создана</strong>
                <p>
                  Техническая заявка отправлена управляющему. Вы сможете
                  отслеживать её статус позже.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setRequestSubmitted(false);
                    setShowRequestModal(false);
                  }}
                >
                  Готово
                </button>
              </div>
            ) : (
              <form
                className="employee-mobile__request-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const formData = new FormData(form);
                  await api.create("technical-requests", {
                    category: String(formData.get("category") || "Оборудование"),
                    title: String(formData.get("title") || "Тех. заявка"),
                    description: String(formData.get("description") || ""),
                    status: "new",
                  });
                  setRequestSubmitted(true);
                }}
              >
                <label>
                  <span>Категория</span>
                  <select name="category" defaultValue="Оборудование">
                    <option>Оборудование</option>
                    <option>Клининг</option>
                    <option>Расходники</option>
                    <option>Электрика</option>
                    <option>Мебель</option>
                  </select>
                </label>
                <label>
                  <span>Коротко о проблеме</span>
                  <input name="title" defaultValue="Не работает лампа у входа" />
                </label>
                <label>
                  <span>Описание</span>
                  <textarea
                    name="description"
                    rows={4}
                    defaultValue="После открытия смены лампа возле входной зоны не включается. Нужна проверка."
                  />
                </label>
                <button type="submit">Создать заявку</button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
