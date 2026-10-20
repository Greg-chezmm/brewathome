import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// Le délai par défaut de 1 s est dépassé quand la machine est chargée (suite complète en parallèle).
configure({ asyncUtilTimeout: 5000 })
