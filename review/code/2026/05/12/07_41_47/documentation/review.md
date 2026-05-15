## Documentation 코드 리뷰

### 발견사항

---

**[WARNING] Plan 문서와 실제 구현 상태 불일치**
- 위치: `plan/in-progress/auth-sessions.md` — Backend/Frontend 체크리스트
- 상세: 체크리스트의 `refresh-token.entity.ts`, `login-history.entity.ts`, `utils/client-ip.ts`, `utils/device-label.ts`, DTOs, `sessions.controller.ts`, `sessions.service.ts`, `auth.service.ts`, 프론트엔드 파일 전부가 `[ ]` 미체크 상태이나, 실제로는 모두 구현 완료된 상태다. CLAUDE.md 규약상 "작업이 끝나면 결과에 맞춰 갱신"해야 하며, 모든 항목이 완료되면 `plan/complete/`로 이동해야 한다.
- 제안: 완료된 항목을 `[x]`로 갱신하고, 남은 미완 항목(검증, ai-review)만 `[ ]`로 두어 plan 이 실상을 반영하도록 수정. 검증 완료 후 `plan/complete/`로 `git mv`.

---

**[WARNING] `SessionDto.ipAddress` Swagger 설명과 실제 반환값 불일치**
- 위치: `session.dto.ts:24` vs `sessions.service.ts:toDto()`
- 상세: Swagger `description`은 `"발급 시점 클라이언트 IP (CF-Connecting-IP 우선)"`라고 설명하나, `toDto()`에서는 `row.lastUsedIp ?? row.ipAddress`를 사용해 마지막 활동 IP를 우선 반환한다. API 문서와 실제 동작이 다르다.
- 제안:
  ```ts
  @ApiProperty({
    description: '마지막 활동 IP (없으면 발급 시점 IP). CF-Connecting-IP 우선 추출.',
    nullable: true,
  })
  ```

---

**[WARNING] `RevokeSessionDto` emailOtp 경로가 서비스에 미구현**
- 위치: `revoke-session.dto.ts:7-12` (JSDoc), `sessions.service.ts:verifyReauth()`
- 상세: DTO JSDoc은 "OAuth-only + 2FA 미설정 사용자 → emailOtp 필수"라고 명시하나, `verifyReauth()`는 `emailOtp` 분기를 처리하지 않는다. 문서화된 사양과 구현이 불일치해 오용 가능성이 있다.
- 제안: JSDoc에 `emailOtp`가 현재 미구현임을 명시하거나(`TODO: emailOtp 분기 구현 예정`), 서비스에 해당 분기를 구현.

---

**[WARNING] `void IsNull` — 오해를 유발하는 주석**
- 위치: `sessions.service.ts` 마지막 줄
- 상세: `void IsNull;`에 "Silence eslint for unused import (kept for explicit Not type clarity)"라는 주석이 붙어 있으나, `IsNull`을 남겨두는 것이 `Not` 타입 명확성에 기여하지 않는다. 실제로는 사용하지 않는 임포트를 정리하지 않은 것에 불과하며, 이 설명은 차후 독자에게 혼란을 준다.
- 제안: `IsNull` 임포트와 해당 줄 모두 제거.

---

**[INFO] 하드코딩된 "Loading…" 문자열이 i18n 우회**
- 위치: `sessions-panel.tsx:109`, `login-history-list.tsx:49`
- 상세: 로딩 상태 텍스트가 한/영 i18n 없이 영문으로 고정되어 있어, 한국어 로캘 사용자에게도 영어로 표시된다.
- 제안: `en.ts`/`ko.ts`에 `profile.sessions.loading` 키를 추가하고 `t()`로 대체.

---

**[INFO] `LoginHistoryService.findForUser` JSDoc 누락**
- 위치: `login-history.service.ts:58`
- 상세: 같은 클래스의 `record()`와 `pruneOlderThanRetention()`에는 JSDoc이 있으나, `findForUser()`에는 없다. 커서 페이징 방식, limit 상한(100), 정렬 방향(DESC) 등 공개 계약 정보가 서명만으로는 드러나지 않는다.
- 제안: 커서 기반 페이징 동작, DEFAULT_LIMIT/MAX_LIMIT 값을 한 줄 JSDoc으로 기술.

---

**[INFO] `deriveDeviceLabel` 컨트롤러 fallback 사용 사유 미문서화**
- 위치: `sessions.controller.ts:getLoginHistory()` — `row.deviceLabel ?? deriveDeviceLabel(row.userAgent)`
- 상세: `LoginHistoryService.record()`에서 이미 `deviceLabel`을 파생해 저장하므로, 컨트롤러에서 다시 `deriveDeviceLabel`을 호출하는 이유(예: 레거시 행 호환성)가 불명확하다.
- 제안: 한 줄 주석으로 이유 명시. 예: `// legacy rows written before deviceLabel column may have null`.

---

**[INFO] `spec/5-system/1-auth.md §4.3`에 emailOtp 재인증 흐름 미언급**
- 위치: `spec/5-system/1-auth.md:4.3` 및 `§2.3 강제 종료 재인증` 항목
- 상세: `§2.3`에 "OAuth-only 사용자는 2FA TOTP 또는 이메일 OTP로 대체"라고 명시되어 있으나, `§4.3`의 `session_revoked` 이벤트 설명과 DTO JSDoc에 `emailOtp` 분기가 언급되지 않아 스펙 내 일관성이 부족하다.
- 제안: `§4.3` 또는 `§2.3` 재인증 항목에 emailOtp 경로의 현재 구현 상태(미구현 또는 예정)를 명시.

---

### 요약

전반적으로 문서화 품질은 높다. SQL 마이그레이션 헤더, `client-ip.ts`의 SECURITY 경고, `verifyReauth()`의 상세 JSDoc, Swagger 데코레이터 등은 잘 작성되어 있다. 주요 리스크는 두 가지다: plan 문서가 구현 완료 상태를 반영하지 않아 CLAUDE.md 규약을 위반하고 있고, `SessionDto.ipAddress`의 Swagger 설명이 실제 반환값(`lastUsedIp` 우선)과 달라 API 소비자에게 오해를 줄 수 있다. 나머지는 낮은 심각도의 i18n 누락·주석 정확성 문제다.

### 위험도

**LOW** — 기능 동작에 직접 영향은 없으나, `SessionDto.ipAddress` 설명 불일치와 `emailOtp` 미구현 상태의 문서화 공백은 향후 API 통합 시 혼란을 줄 수 있다.