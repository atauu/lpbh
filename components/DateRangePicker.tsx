'use client';

import { useMemo, useState } from 'react';

interface DateRangePickerProps {
	startDate: string; // 'YYYY-MM-DD' or ''
	endDate: string;   // 'YYYY-MM-DD' or ''
	onChange: (startDate: string, endDate: string) => void;
	className?: string;
}

function toYmd(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function fromYmd(ymd: string): Date {
	const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
	return new Date(y, (m || 1) - 1, d || 1);
}

function isSameDay(a: Date, b: Date): boolean {
	return a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate();
}

function isWithinRange(day: Date, start?: Date, end?: Date): boolean {
	if (!start || !end) return false;
	const t = day.setHours(0, 0, 0, 0);
	const s = start.setHours(0, 0, 0, 0);
	const e = end.setHours(0, 0, 0, 0);
	return t >= s && t <= e;
}

export default function DateRangePicker({
	startDate,
	endDate,
	onChange,
	className,
}: DateRangePickerProps) {
	const initial = startDate ? fromYmd(startDate) : new Date();
	const [viewYear, setViewYear] = useState(initial.getFullYear());
	const [viewMonth, setViewMonth] = useState(initial.getMonth()); // 0-11

	const start = startDate ? fromYmd(startDate) : undefined;
	const end = endDate ? fromYmd(endDate) : undefined;

	const firstOfMonth = useMemo(() => new Date(viewYear, viewMonth, 1), [viewYear, viewMonth]);
	const daysInMonth = useMemo(() => new Date(viewYear, viewMonth + 1, 0).getDate(), [viewYear, viewMonth]);
	const startWeekday = useMemo(() => firstOfMonth.getDay(), [firstOfMonth]); // 0 (Sun) - 6 (Sat)

	const weeks = useMemo(() => {
		const days: Array<Date | null> = [];
		// We want Monday as first column? Current UI uses locale. We'll keep Sun-Sat to keep logic simple.
		for (let i = 0; i < startWeekday; i++) {
			days.push(null);
		}
		for (let d = 1; d <= daysInMonth; d++) {
			days.push(new Date(viewYear, viewMonth, d));
		}
		// Fill to 6 rows * 7 cols = 42 cells
		while (days.length % 7 !== 0) {
			days.push(null);
		}
		const weeks: Array<Array<Date | null>> = [];
		for (let i = 0; i < days.length; i += 7) {
			weeks.push(days.slice(i, i + 7));
		}
		return weeks;
	}, [startWeekday, daysInMonth, viewYear, viewMonth]);

	const handlePrevMonth = () => {
		if (viewMonth === 0) {
			setViewMonth(11);
			setViewYear((y) => y - 1);
		} else {
			setViewMonth((m) => m - 1);
		}
	};
	const handleNextMonth = () => {
		if (viewMonth === 11) {
			setViewMonth(0);
			setViewYear((y) => y + 1);
		} else {
			setViewMonth((m) => m + 1);
		}
	};

	const handleSelect = (day: Date | null) => {
		if (!day) return;
		const ymd = toYmd(day);
		// No selection yet
		if (!startDate && !endDate) {
			onChange(ymd, '');
			return;
		}
		// Only start selected -> set end (swap if needed)
		if (startDate && !endDate) {
			const s = fromYmd(startDate);
			if (day < s) {
				onChange(ymd, toYmd(s));
			} else {
				onChange(startDate, ymd);
			}
			return;
		}
		// Both selected -> reset and set new start
		if (startDate && endDate) {
			onChange(ymd, '');
			return;
		}
	};

	const weekdays = ['Paz', 'Pts', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
	const monthNames = [
		'Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
		'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'
	];

	return (
		<div className={className}>
			<div className="flex items-center justify-between mb-2">
				<button
					onClick={handlePrevMonth}
					className="px-2 py-1 text-sm border border-border rounded-md text-text-secondary hover:bg-background-tertiary transition"
				>
					‹
				</button>
				<div className="text-sm font-medium text-text-primary">
					{monthNames[viewMonth]} {viewYear}
				</div>
				<button
					onClick={handleNextMonth}
					className="px-2 py-1 text-sm border border-border rounded-md text-text-secondary hover:bg-background-tertiary transition"
				>
					›
				</button>
			</div>
			<div className="grid grid-cols-7 gap-1 text-center text-[11px] text-text-muted mb-1">
				{weekdays.map((w) => (
					<div key={w} className="py-1">{w}</div>
				))}
			</div>
			<div className="grid grid-cols-7 gap-1">
				{weeks.map((week, wi) => (
					<div key={wi} className="contents">
						{week.map((day, di) => {
							if (!day) {
								return <div key={di} className="h-8 rounded" />;
							}
							const isStart = start ? isSameDay(day, start) : false;
							const isEnd = end ? isSameDay(day, end) : false;
							const inRange = isWithinRange(new Date(day), start, end);
							const isToday = isSameDay(day, new Date());
							const classes = [
								'h-8',
								'rounded-md',
								'text-sm',
								'flex',
								'items-center',
								'justify-center',
								'cursor-pointer',
								'transition',
								inRange ? 'bg-primary/20 text-primary border border-primary/30' : 'border border-border hover:bg-background-tertiary text-text-primary',
								isStart || isEnd ? 'bg-primary text-white border-primary' : '',
								isToday && !(isStart || isEnd) && !inRange ? 'ring-1 ring-primary/40' : '',
							].join(' ');
							return (
								<div
									key={di}
									className={classes}
									onClick={() => handleSelect(day)}
									title={toYmd(day)}
								>
									{day.getDate()}
								</div>
							);
						})}
					</div>
				))}
			</div>
			<div className="mt-2 text-[12px] text-text-secondary">
				<span className="mr-2">Başlangıç:</span>
				<span className="mr-4">{startDate ? new Date(startDate).toLocaleDateString('tr-TR') : '—'}</span>
				<span className="mr-2">Bitiş:</span>
				<span>{endDate ? new Date(endDate).toLocaleDateString('tr-TR') : '—'}</span>
			</div>
		</div>
	);
}


