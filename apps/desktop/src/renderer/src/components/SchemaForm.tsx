/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react'
import { Plus, Trash2, X } from 'lucide-react'

interface SchemaFormProps {
  schema: Record<string, any>
  value: any
  onChange: (value: any) => void
  root?: boolean
}

function KeyValueField({
  value,
  onChange,
  title
}: {
  value: Record<string, string>
  onChange: (val: Record<string, string>) => void
  title?: string
}) {
  const pairs = Object.entries(value || {})

  const updatePair = (oldKey: string, newKey: string, newValue: string) => {
    const newObj = { ...value }
    if (oldKey !== newKey) {
      delete newObj[oldKey]
    }
    newObj[newKey] = newValue
    onChange(newObj)
  }

  const removePair = (key: string) => {
    const newObj = { ...value }
    delete newObj[key]
    onChange(newObj)
  }

  const addPair = () => {
    const newObj = { ...value }
    let counter = 1
    while (newObj[`key${counter}`]) counter++
    newObj[`key${counter}`] = ''
    onChange(newObj)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">{title}</label>
        <button
          type="button"
          onClick={addPair}
          className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700"
        >
          <Plus className="w-3 h-3" /> 添加项
        </button>
      </div>
      <div className="space-y-2">
        {pairs.map(([key, val]) => (
          <div key={key} className="flex gap-2 items-center">
            <input
              type="text"
              className="flex-1 h-8 rounded-md border border-gray-200 bg-transparent px-2 text-sm"
              placeholder="Key"
              value={key}
              onChange={(e) => updatePair(key, e.target.value, val)}
            />
            <input
              type="text"
              className="flex-1 h-8 rounded-md border border-gray-200 bg-transparent px-2 text-sm"
              placeholder="Value"
              value={val}
              onChange={(e) => updatePair(key, key, e.target.value)}
            />
            <button
              onClick={() => removePair(key)}
              className="p-1 text-gray-400 hover:text-red-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        {pairs.length === 0 && <div className="text-xs text-gray-400 italic">暂无配置项</div>}
      </div>
    </div>
  )
}

function ArrayField({
  schema,
  value,
  onChange,
  title
}: {
  schema: any
  value: any[]
  onChange: (val: any[]) => void
  title?: string
}) {
  const items = Array.isArray(value) ? value : []

  const addItem = () => {
    // Determine default value based on item type
    let defaultValue: any = ''
    if (schema.items.type === 'object') defaultValue = {}
    if (schema.items.type === 'array') defaultValue = []
    if (schema.items.type === 'number') defaultValue = 0
    if (schema.items.type === 'boolean') defaultValue = false

    onChange([...items, defaultValue])
  }

  const removeItem = (index: number) => {
    const newItems = [...items]
    newItems.splice(index, 1)
    onChange(newItems)
  }

  const updateItem = (index: number, newValue: any) => {
    const newItems = [...items]
    newItems[index] = newValue
    onChange(newItems)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">{title}</label>
        <button
          type="button"
          onClick={addItem}
          className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700"
        >
          <Plus className="w-3 h-3" /> 添加
        </button>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2 items-start group">
            <div className="flex-1 min-w-0 border-l-2 border-gray-100 pl-3">
              <FieldRenderer
                schema={schema.items}
                value={item}
                onChange={(val) => updateItem(index, val)}
                compact
              />
            </div>
            <button
              onClick={() => removeItem(index)}
              className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              title="删除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-xs text-gray-400 italic p-2 border border-dashed border-gray-200 rounded text-center">
            空列表
          </div>
        )}
      </div>
    </div>
  )
}

function FieldRenderer({
  schema,
  value,
  onChange,
  title,
  compact = false
}: {
  schema: any
  value: any
  onChange: (val: any) => void
  title?: string
  compact?: boolean
}) {
  const fieldType = schema.type || 'string'
  const fieldDescription = schema.description || ''

  // Render Label
  const renderLabel = () => {
    if (compact || !title) return null
    return (
      <label className="block text-sm font-medium text-gray-700">
        {title}
        {schema.required && <span className="text-red-500 ml-1">*</span>}
      </label>
    )
  }

  // Handle specific types
  if (fieldType === 'object') {
    if (schema.additionalProperties) {
      return <KeyValueField value={value} onChange={onChange} title={title} />
    }
    // Nested Object
    return (
      <div className="space-y-2">
        {renderLabel()}
        <div className={compact ? '' : 'border border-gray-100 rounded-lg p-3 bg-gray-50/50'}>
          <SchemaForm schema={schema} value={value || {}} onChange={onChange} root={false} />
        </div>
      </div>
    )
  }

  if (fieldType === 'array') {
    return <ArrayField schema={schema} value={value} onChange={onChange} title={title} />
  }

  // Primitives
  return (
    <div className="space-y-1.5">
      {renderLabel()}

      {fieldType === 'string' && !schema.enum && schema.format === 'textarea' && (
        <textarea
          className="flex min-h-[80px] w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fieldDescription}
        />
      )}

      {fieldType === 'string' && !schema.enum && schema.format !== 'textarea' && (
        <input
          type="text"
          className="flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fieldDescription}
        />
      )}

      {fieldType === 'string' && schema.enum && (
        <select
          className="flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        >
          {schema.enum.map((option: string) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}

      {fieldType === 'number' && (
        <input
          type="number"
          className="flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          value={value || 0}
          onChange={(e) => onChange(Number(e.target.value))}
          min={schema.minimum}
          max={schema.maximum}
          step={schema.type === 'integer' ? 1 : 'any'}
        />
      )}

      {fieldType === 'boolean' && (
        <div className="flex items-center space-x-2 h-9">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="text-sm text-gray-500">{fieldDescription || (title ? '' : '启用')}</span>
        </div>
      )}

      {fieldDescription && fieldType !== 'boolean' && (
        <p className="text-xs text-gray-500">{fieldDescription}</p>
      )}
    </div>
  )
}

export function SchemaForm({ schema, value, onChange, root = true }: SchemaFormProps) {
  if (!schema || !schema.properties) {
    return <div className="text-gray-500 text-sm">无效的配置 Schema</div>
  }

  const handleChange = (key: string, newValue: any) => {
    onChange({
      ...value,
      [key]: newValue
    })
  }

  return (
    <div className={`space-y-4 ${root ? '' : ''}`}>
      {Object.entries(schema.properties).map(([key, field]: [string, any]) => {
        const fieldTitle = field.title || key

        return (
          <FieldRenderer
            key={key}
            schema={field}
            value={value?.[key]}
            onChange={(val) => handleChange(key, val)}
            title={fieldTitle}
          />
        )
      })}
    </div>
  )
}
