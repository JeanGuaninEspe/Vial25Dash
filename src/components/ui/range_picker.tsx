"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { type DateRange } from "react-day-picker"

type DatePickerWithRangeProps = {
  value: DateRange | undefined
  onChange: (value: DateRange | undefined) => void
  label?: string
  id?: string
  className?: string
}

export function DatePickerWithRange({
  value,
  onChange,
  label,
  id = "date-picker-range",
  className,
}: DatePickerWithRangeProps) {
  const date = value

  return (
    <Field className={className ?? "mx-auto w-60"}>
      {label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id={id}
            className="h-10 justify-start gap-2 px-2.5 text-base font-semibold"
          >
            <CalendarIcon />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "dd MMM yyyy", { locale: es })} -{" "}
                  {format(date.to, "dd MMM yyyy", { locale: es })}
                </>
              ) : (
                format(date.from, "dd MMM yyyy", { locale: es })
              )
            ) : (
              <span>Selecciona un rango</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={onChange}
            numberOfMonths={2}
            locale={es}
          />
        </PopoverContent>
      </Popover>
    </Field>
  )
}
