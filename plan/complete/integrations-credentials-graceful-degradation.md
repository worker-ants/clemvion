# integrations credentials graceful degradation

## 배경

`/integrations` 페이지가 500을 반환한다. `decryptJson()`이 `Decipheriv.final()` 단계에서 throw 하기 때문에 단일 손상 행이 list 엔드포인트 전체를 폭파시킨다. 원인은 행 암호화 시점과 현재의 `INTEGRATION_ENCRYPTION_KEY`가 다른 것. 옛 키 복원은 범위 외이고, 손상 행은 UI에서 "재인증 필요"로 노출 후 사용자가 재연결 흐름으로 새 키 envelope을 덮어쓰는 방식으로 복구한다.

## 작업 체크리스트

### Backend

- [x] `services/credentials-transformer.ts` — `decryptJson()` 비-throw화. 실패 시 sentinel `{ __unreadable: true }` 반환. JSDoc 갱신.
- [x] `services/credentials-transformer.spec.ts` — 기존 "throws on tampered" 케이스를 "returns sentinel"로 교체하고, base64 깨짐 / 길이 부족 / 잘못된 version / 잘못된 JSON / legacy 비-JSON / 키 없는데 envelope 들어오면 → sentinel 케이스 추가.
- [x] `integrations.service.ts` — `IntegrationCredentialsUnreadableError` export. `isCredentialsUnreadable()` helper. `toPublic()`에서 sentinel 처리 (status='error', statusReason='credentials_unreadable', credentialsStatus='needs_reauth', credentials={}, lastError=null). `getForExecution()`에서 sentinel 감지 시 throw.
- [x] `integrations.service.spec.ts` — sentinel을 가진 mock 행에 대해 findAll/findById/getForExecution 동작 검증.
- [x] `dto/responses/integration-response.dto.ts` — `credentialsStatus: 'ok' | 'needs_reauth'` 필드 추가.

### Frontend

- [x] `lib/api/integrations.ts` — `IntegrationDto`에 `credentialsStatus?: 'ok' | 'needs_reauth'` 추가.
- [x] `app/(main)/integrations/_shared/status-badge.tsx` — `statusReason === 'credentials_unreadable'`인 경우 "재인증 필요"로 렌더 + `needsAttention()` 회복 (이미 status='error'이므로 동작은 동일).
- [x] i18n 엔트리 추가 (en/ko) — `integrations.statusCredentialsUnreadable`.

### 검증

- [x] `npm test -- credentials-transformer integrations.service` green.
- [x] backend typecheck pass (`npm run typecheck` 또는 `npm run build`의 ts 단계).
- [x] frontend typecheck pass.
- [x] 수동 회귀: `/integrations` 정상 행만 있을 때 200 + 정상 카드. (사용자 검증 완료, 2026-05-12)
- [x] 수동 손상 재현: 일부러 잘못된 envelope으로 row 갱신 후 `/integrations` 200 + 손상 카드는 "재인증 필요" 표시. (사용자 검증 완료, 2026-05-12)

## 완료 시

모든 자동/수동 항목이 끝나면 `git mv plan/in-progress/integrations-credentials-graceful-degradation.md plan/complete/`.
