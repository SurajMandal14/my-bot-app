
"use client";

import { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { CheckIcon, ChevronsUpDown } from 'lucide-react';
import { Controller, useFormContext } from 'react-hook-form';
import { FormLabel, FormMessage } from './form'; // Assuming you have these from shadcn
import { cn } from '@/lib/utils';

interface ListboxOption {
  value: string;
  label: string;
}

interface ControlledListboxProps {
  control: any;
  name: string;
  label: string;
  options: ListboxOption[];
  placeholder?: string;
  onChangeCallback?: (value: string | null) => void;
}

export function ControlledListbox({
  control,
  name,
  label,
  options,
  placeholder = 'Select an option',
  onChangeCallback,
}: ControlledListboxProps) {
  const { getFieldState } = useFormContext();
  const fieldState = getFieldState(name);
  const hasError = !!fieldState.error;

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <div className="w-full">
          <Listbox
            value={field.value || null}
            onChange={(value) => {
              field.onChange(value);
              if (onChangeCallback) {
                onChangeCallback(value);
              }
            }}
          >
            {({ open }) => (
              <>
                <FormLabel>{label}</FormLabel>
                <div className="relative mt-2">
                  <Listbox.Button
                    className={cn(
                      "relative w-full cursor-default rounded-md bg-background py-2 pl-3 pr-10 text-left text-sm text-foreground shadow-sm ring-1 ring-inset ring-input focus:outline-none focus:ring-2 focus:ring-ring sm:leading-6",
                      hasError && "ring-destructive"
                    )}
                  >
                    <span className="block truncate">
                      {options.find(opt => opt.value === field.value)?.label || <span className="text-muted-foreground">{placeholder}</span>}
                    </span>
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                      <ChevronsUpDown
                        className="h-5 w-5 text-gray-400"
                        aria-hidden="true"
                      />
                    </span>
                  </Listbox.Button>

                  <Transition
                    show={open}
                    as={Fragment}
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                      {options.map((option) => (
                        <Listbox.Option
                          key={option.value}
                          className={({ active }) =>
                            cn(
                              'relative cursor-default select-none py-2 pl-8 pr-4',
                              active ? 'bg-accent text-accent-foreground' : 'text-foreground'
                            )
                          }
                          value={option.value}
                        >
                          {({ selected, active }) => (
                            <>
                              <span
                                className={cn(
                                  'block truncate',
                                  selected ? 'font-semibold' : 'font-normal'
                                )}
                              >
                                {option.label}
                              </span>

                              {selected ? (
                                <span
                                  className={cn(
                                    'absolute inset-y-0 left-0 flex items-center pl-1.5',
                                    active ? 'text-accent-foreground' : 'text-primary'
                                  )}
                                >
                                  <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                </span>
                              ) : null}
                            </>
                          )}
                        </Listbox.Option>
                      ))}
                    </Listbox.Options>
                  </Transition>
                </div>
                <FormMessage />
              </>
            )}
          </Listbox>
        </div>
      )}
    />
  );
}
