'use client';

import { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/utils/cn';

interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  onCustomValue?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowCustom?: boolean;
  label?: string;
  required?: boolean;
  id?: string;
  name?: string;
}

export default function Combobox({
  options,
  value,
  onChange,
  onCustomValue,
  placeholder = 'Sélectionner ou saisir...',
  className,
  disabled = false,
  allowCustom = true,
  label,
  required = false,
  id,
  name,
}: ComboboxProps) {
  const generatedId = useId();
  const inputId = id || name || generatedId;
  const inputName = name || id || undefined;
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [filteredOptions, setFilteredOptions] = useState<ComboboxOption[]>(options);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Trouver l'option sélectionnée
  const selectedOption = options.find((opt) => opt.value === value);

  // Initialiser inputValue avec le label de l'option sélectionnée
  useEffect(() => {
    if (selectedOption) {
      setInputValue(selectedOption.label);
    } else if (value && allowCustom) {
      setInputValue(value);
    } else {
      setInputValue('');
    }
  }, [value, selectedOption, allowCustom]);

  // Filtrer les options selon la saisie
  useEffect(() => {
    if (inputValue.trim() === '') {
      setFilteredOptions(options);
    } else {
      const filtered = options.filter((opt) =>
        opt.label.toLowerCase().includes(inputValue.toLowerCase())
      );
      setFilteredOptions(filtered);
    }
  }, [inputValue, options]);

  // Fermer le dropdown si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(true);

    // Si la valeur correspond exactement à une option, la sélectionner
    const exactMatch = options.find((opt) => opt.label.toLowerCase() === newValue.toLowerCase());
    if (exactMatch) {
      onChange(exactMatch.value);
    } else if (allowCustom && onCustomValue) {
      // Permettre la saisie manuelle
      onCustomValue(newValue);
    }
  };

  const handleSelectOption = (option: ComboboxOption) => {
    onChange(option.value);
    setInputValue(option.label);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setInputValue('');
    if (allowCustom && onCustomValue) {
      onCustomValue('');
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-2">
          {label} {required && <span className="text-error">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          name={inputName}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={cn(
            'w-full px-4 py-2 pr-10 border-2 border-gray-300 rounded-lg',
            'focus:ring-2 focus:ring-primary focus:border-primary',
            'outline-none transition-all',
            disabled && 'bg-gray-100 cursor-not-allowed',
            'text-sm'
          )}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
          <ChevronDown
            className={cn(
              'w-4 h-4 text-gray-400 transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-auto">
          {filteredOptions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              {allowCustom ? 'Aucun résultat. Saisissez une valeur personnalisée.' : 'Aucun résultat'}
            </div>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelectOption(option)}
                className={cn(
                  'w-full text-left px-4 py-2 hover:bg-primary/5 transition-colors',
                  value === option.value && 'bg-primary/10 text-primary font-medium'
                )}
              >
                {option.label}
              </button>
            ))
          )}
          {allowCustom && inputValue.trim() !== '' && !selectedOption && (
            <button
              type="button"
              onClick={() => {
                if (onCustomValue) {
                  onCustomValue(inputValue);
                  onChange(inputValue);
                }
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-primary/5 transition-colors border-t border-gray-200 text-primary font-medium"
            >
              Utiliser &quot;{inputValue}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  );
}

