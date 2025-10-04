/**
 * @file utils/validationSchemas.ts
 * @description Production-ready Zod validation schemas for all user inputs
 * @version 1.0.0
 * 
 * FIXES BUG #21: Comprehensive input validation using Zod
 * 
 * Production Standards:
 * - Type-safe validation for all user inputs
 * - Detailed error messages for user feedback
 * - Sanitization of potentially harmful inputs
 * - Custom refinements for complex validation rules
 */

import { z } from 'zod';
import { EventType, EventSeverity } from '@types/api.types';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_SEARCH_LENGTH = 500;
const MAX_CUSTOM_FILTER_NAME_LENGTH = 100;
const MIN_API_KEY_LENGTH = 20;
const MAX_API_KEY_LENGTH = 64;

// Dangerous patterns to sanitize
const SQL_INJECTION_PATTERN = /('|(--)|;|\/\*|\*\/|xp_|sp_|exec|execute|drop|create|alter|insert|update|delete)/i;
const XSS_PATTERN = /<script|javascript:|onerror=|onclick=/i;

// ============================================================================
// PRIMITIVE VALIDATORS
// ============================================================================

/**
 * Safe string validator with length limits and sanitization
 */
const createSafeStringSchema = (options: {
  min?: number;
  max?: number;
  fieldName?: string;
  allowEmpty?: boolean;
}) => {
  const { min = 0, max = 1000, fieldName = 'Input', allowEmpty = false } = options;

  let schema = z.string({
    required_error: `${fieldName} is required`,
    invalid_type_error: `${fieldName} must be a string`,
  });

  if (!allowEmpty) {
    schema = schema.min(1, `${fieldName} cannot be empty`);
  }

  return schema
    .max(max, `${fieldName} cannot exceed ${max} characters`)
    .refine(
      (val) => !SQL_INJECTION_PATTERN.test(val),
      { message: `${fieldName} contains invalid characters` }
    )
    .refine(
      (val) => !XSS_PATTERN.test(val),
      { message: `${fieldName} contains potentially unsafe content` }
    )
    .transform((val) => val.trim());
};

/**
 * Positive integer validator
 */
const positiveIntSchema = (fieldName: string = 'Number') =>
  z.number({
    required_error: `${fieldName} is required`,
    invalid_type_error: `${fieldName} must be a number`,
  })
    .int(`${fieldName} must be an integer`)
    .positive(`${fieldName} must be positive`);

/**
 * Date validator with range checking
 */
const dateSchema = (options: {
  fieldName?: string;
  minDate?: Date;
  maxDate?: Date;
}) => {
  const { fieldName = 'Date', minDate, maxDate } = options;

  let schema = z.date({
    required_error: `${fieldName} is required`,
    invalid_type_error: `${fieldName} must be a valid date`,
  });

  if (minDate) {
    schema = schema.min(minDate, `${fieldName} cannot be before ${minDate.toLocaleDateString()}`);
  }

  if (maxDate) {
    schema = schema.max(maxDate, `${fieldName} cannot be after ${maxDate.toLocaleDateString()}`);
  }

  return schema;
};

// ============================================================================
// SEARCH VALIDATION
// ============================================================================

/**
 * Search query validation schema
 */
export const searchQuerySchema = createSafeStringSchema({
  min: 0,
  max: MAX_SEARCH_LENGTH,
  fieldName: 'Search query',
  allowEmpty: true,
}).refine(
  (val) => {
    // Prevent extremely short search terms that would return too many results
    if (val.length > 0 && val.length < 2) {
      return false;
    }
    return true;
  },
  { message: 'Search query must be at least 2 characters' }
);

/**
 * Validate and sanitize search input
 */
export const validateSearchQuery = (query: string): {
  success: boolean;
  data?: string;
  error?: string;
} => {
  const result = searchQuerySchema.safeParse(query);
  
  if (!result.success) {
    return {
      success: false,
      error: result.error.errors[0]?.message || 'Invalid search query',
    };
  }

  return {
    success: true,
    data: result.data,
  };
};

// ============================================================================
// FILTER VALIDATION
// ============================================================================

/**
 * Event type validation schema
 */
export const eventTypeSchema = z.nativeEnum(EventType, {
  errorMap: () => ({ message: 'Invalid event type' }),
});

/**
 * Event severity validation schema
 */
export const eventSeveritySchema = z.nativeEnum(EventSeverity, {
  errorMap: () => ({ message: 'Invalid severity level' }),
});

/**
 * Array of event types validation
 */
export const eventTypesArraySchema = z
  .array(eventTypeSchema)
  .max(20, 'Cannot select more than 20 event types')
  .optional();

/**
 * Array of severities validation
 */
export const severitiesArraySchema = z
  .array(eventSeveritySchema)
  .max(10, 'Cannot select more than 10 severity levels')
  .optional();

/**
 * Complete filter state validation schema
 */
export const filterStateSchema = z.object({
  searchTerm: searchQuerySchema.optional(),
  eventTypes: eventTypesArraySchema,
  severities: severitiesArraySchema,
  showClosuresOnly: z.boolean().optional(),
  showActiveOnly: z.boolean().optional(),
  sortBy: z.enum(['severity', 'date', 'type', 'location']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * Validate filter state
 */
export const validateFilterState = (filters: unknown): {
  success: boolean;
  data?: z.infer<typeof filterStateSchema>;
  errors?: string[];
} => {
  const result = filterStateSchema.safeParse(filters);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map((e) => e.message),
    };
  }

  return {
    success: true,
    data: result.data,
  };
};

// ============================================================================
// DATE RANGE VALIDATION
// ============================================================================

/**
 * Date range validation schema
 */
export const dateRangeSchema = z
  .object({
    startDate: dateSchema({
      fieldName: 'Start date',
      minDate: new Date('2020-01-01'),
      maxDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year in future
    }),
    endDate: dateSchema({
      fieldName: 'End date',
      minDate: new Date('2020-01-01'),
      maxDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    }),
  })
  .refine(
    (data) => data.endDate >= data.startDate,
    {
      message: 'End date must be after start date',
      path: ['endDate'],
    }
  )
  .refine(
    (data) => {
      const daysDiff = (data.endDate.getTime() - data.startDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 365;
    },
    {
      message: 'Date range cannot exceed 1 year',
      path: ['endDate'],
    }
  );

/**
 * Validate date range
 */
export const validateDateRange = (range: unknown): {
  success: boolean;
  data?: z.infer<typeof dateRangeSchema>;
  error?: string;
} => {
  const result = dateRangeSchema.safeParse(range);

  if (!result.success) {
    return {
      success: false,
      error: result.error.errors[0]?.message || 'Invalid date range',
    };
  }

  return {
    success: true,
    data: result.data,
  };
};

// ============================================================================
// API KEY VALIDATION
// ============================================================================

/**
 * API key validation schema
 */
export const apiKeySchema = z
  .string({
    required_error: 'API key is required',
    invalid_type_error: 'API key must be a string',
  })
  .min(MIN_API_KEY_LENGTH, `API key must be at least ${MIN_API_KEY_LENGTH} characters`)
  .max(MAX_API_KEY_LENGTH, `API key cannot exceed ${MAX_API_KEY_LENGTH} characters`)
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'API key can only contain letters, numbers, hyphens, and underscores'
  )
  .transform((val) => val.trim());

/**
 * Validate API key
 */
export const validateApiKey = (key: string): {
  success: boolean;
  data?: string;
  error?: string;
} => {
  const result = apiKeySchema.safeParse(key);

  if (!result.success) {
    return {
      success: false,
      error: result.error.errors[0]?.message || 'Invalid API key format',
    };
  }

  return {
    success: true,
    data: result.data,
  };
};

// ============================================================================
// CUSTOM FILTER VALIDATION
// ============================================================================

/**
 * Custom filter name validation schema
 */
export const customFilterNameSchema = createSafeStringSchema({
  min: 1,
  max: MAX_CUSTOM_FILTER_NAME_LENGTH,
  fieldName: 'Filter name',
  allowEmpty: false,
});

/**
 * Saved filter validation schema
 */
export const savedFilterSchema = z.object({
  id: z.string().uuid('Invalid filter ID'),
  name: customFilterNameSchema,
  filters: filterStateSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Validate custom filter name
 */
export const validateCustomFilterName = (name: string): {
  success: boolean;
  data?: string;
  error?: string;
} => {
  const result = customFilterNameSchema.safeParse(name);

  if (!result.success) {
    return {
      success: false,
      error: result.error.errors[0]?.message || 'Invalid filter name',
    };
  }

  return {
    success: true,
    data: result.data,
  };
};

// ============================================================================
// COORDINATE VALIDATION
// ============================================================================

/**
 * Latitude validation schema
 */
export const latitudeSchema = z
  .number({
    required_error: 'Latitude is required',
    invalid_type_error: 'Latitude must be a number',
  })
  .min(-90, 'Latitude must be between -90 and 90')
  .max(90, 'Latitude must be between -90 and 90')
  .finite('Latitude must be a finite number');

/**
 * Longitude validation schema
 */
export const longitudeSchema = z
  .number({
    required_error: 'Longitude is required',
    invalid_type_error: 'Longitude must be a number',
  })
  .min(-180, 'Longitude must be between -180 and 180')
  .max(180, 'Longitude must be between -180 and 180')
  .finite('Longitude must be a finite number');

/**
 * Geographic coordinates validation schema
 */
export const coordinatesSchema = z.object({
  lat: latitudeSchema,
  lng: longitudeSchema,
});

/**
 * Validate coordinates
 */
export const validateCoordinates = (coords: unknown): {
  success: boolean;
  data?: { lat: number; lng: number };
  error?: string;
} => {
  const result = coordinatesSchema.safeParse(coords);

  if (!result.success) {
    return {
      success: false,
      error: result.error.errors[0]?.message || 'Invalid coordinates',
    };
  }

  return {
    success: true,
    data: result.data,
  };
};

// ============================================================================
// PAGINATION VALIDATION
// ============================================================================

/**
 * Pagination parameters validation schema
 */
export const paginationSchema = z.object({
  page: positiveIntSchema('Page number').default(1),
  limit: z
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(20),
  offset: z
    .number()
    .int('Offset must be an integer')
    .min(0, 'Offset must be non-negative')
    .optional(),
});

// ============================================================================
// EXPORT ALL SCHEMAS
// ============================================================================

export const validationSchemas = {
  search: searchQuerySchema,
  eventType: eventTypeSchema,
  eventSeverity: eventSeveritySchema,
  eventTypesArray: eventTypesArraySchema,
  severitiesArray: severitiesArraySchema,
  filterState: filterStateSchema,
  dateRange: dateRangeSchema,
  apiKey: apiKeySchema,
  customFilterName: customFilterNameSchema,
  savedFilter: savedFilterSchema,
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  coordinates: coordinatesSchema,
  pagination: paginationSchema,
};

export type FilterState = z.infer<typeof filterStateSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;
export type SavedFilter = z.infer<typeof savedFilterSchema>;
export type Coordinates = z.infer<typeof coordinatesSchema>;
export type PaginationParams = z.infer<typeof paginationSchema>;
