import { z } from 'zod';

export const attendeeRoleSchema = z.enum(
  [
    'Grantee',
    'Partner',
    'OAK Staff',
    'Coordination Team',
    'Presenter',
    'Observer',
  ],
  {
    errorMap: () => ({ message: 'Please select your role / capacity' }),
  }
);

export const registrationSchema = z.object({
  firstName: z
    .string({ required_error: 'First name is required' })
    .trim()
    .min(1, 'First name is required')
    .min(2, 'First name must be at least 2 characters')
    .max(100, 'First name cannot exceed 100 characters'),
  lastName: z
    .string({ required_error: 'Last name is required' })
    .trim()
    .min(1, 'Last name is required')
    .min(2, 'Last name must be at least 2 characters')
    .max(100, 'Last name cannot exceed 100 characters'),
  organization: z
    .string({ required_error: 'Organisation is required' })
    .trim()
    .min(1, 'Please select or specify your organisation')
    .min(2, 'Organisation name must be at least 2 characters')
    .max(200, 'Organisation name cannot exceed 200 characters'),
  subPartner: z
    .string()
    .trim()
    .max(200, 'Sub-grantee / Programme Area cannot exceed 200 characters')
    .optional(),
  email: z
    .string({ required_error: 'Email address is required' })
    .trim()
    .toLowerCase()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address (e.g. name@organisation.org)')
    .max(254, 'Email address cannot exceed 254 characters'),
  phone: z
    .union([
      z.literal(''),
      z
        .string()
        .trim()
        .min(5, 'Phone number must be at least 5 digits (e.g. +263 77 123 4567)')
        .max(40, 'Phone number cannot exceed 40 characters'),
    ])
    .optional(),
  role: attendeeRoleSchema,
  dietary: z.string().trim().max(1000, 'Dietary requirements cannot exceed 1000 characters').optional(),
  accessibility: z.string().trim().max(1000, 'Accessibility requirements cannot exceed 1000 characters').optional(),
  travel: z.string().trim().max(1000, 'Travel details cannot exceed 1000 characters').optional(),
  accommodation: z.string().trim().max(1000, 'Accommodation details cannot exceed 1000 characters').optional(),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'You must agree to the privacy policy to complete registration' }),
  }),
}).strict();

export type RegistrationFormData = z.infer<typeof registrationSchema>;

export const checkInSchema = z.object({
  code: z.string().max(2048).trim().min(1, 'Attendee ID or Event Code is required'),
  eventDay: z
    .union([
      z.literal('auto'),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid event day format (YYYY-MM-DD)')
    ])
    .optional(),
  scannedAt: z.string().datetime({ offset: true }).optional(),
});

export type CheckInInput = z.infer<typeof checkInSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;
