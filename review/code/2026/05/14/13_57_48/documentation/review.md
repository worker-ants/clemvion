## 리뷰 결과 — Documentation

### 발견사항

---

**[INFO]** `verifyHmac` 함수 JSDoc — 알고리즘 참조가 정확하고 상세함
- 위치: `integration-oauth.service.ts` L857–L889
- 상세: 공식 Cafe24 Java 샘플 기준 알고리즘 출처가 명시되어 있고, 각 단계가 구체적으로 기술됨. 아울러 spec/4-cafe24.md §9.8에 동일 알고리즘이 TypeScript 예시와 함께 병기되어 단일 소스가 아닌 이중 관리 구조.
- 제안: 서비스 코드의 JSDoc 주석이 spec의 §9.8을 참조하거나, spec의 코드 블록이 "구현 위치: integration-oauth.service.ts `verifyHmac`" 링크를 달아 한 쪽이 정본임을 명시.

---

**[INFO]** `handleInstall` JSDoc — 에러 코드 열거 불완전
- 위치: `integration-oauth.service.ts` L648–L653
- 상세: JSDoc에 `CAFE24_INSTALL_REPLAY`, `CAFE24_INSTALL_INVALID_HMAC` 두 에러 코드만 기술. spec(§9.2 API 표)에는 `CAFE24_INSTALL_NO_PENDING`(404)도 명시되어 있으나, 구현에서는 해당 케이스가 `CAFE24_INSTALL_INVALID_HMAC`(403)으로 통합됨.
- 제안: JSDoc에 "no_pending Integration은 INVALID_HMAC과 동일 403으로 처리 (정보 노출 방지)" 한 줄 추가하거나, spec API 표에서 `CAFE24_INSTALL_NO_PENDING`(404) 항목을 삭제하여 구현과 일치시킬 것.

---

**[WARNING]** spec API 표의 에러 코드와 구현 불일치
- 위치: `spec/2-navigation/4-integration.md` L652 (§9.2 API 표)
- 상세: spec에 `CAFE24_INSTALL_NO_PENDING`(404)가 별도 에러로 등록되어 있으나 실제 구현(`handleInstall`)은 pending Integration 미발견 시 `CAFE24_INSTALL_INVALID_HMAC`(403)를 던짐. 이 불일치는 API 연동 개발자가 404를 핸들링하는 코드를 작성하게 유도할 수 있음.
- 제안: spec의 해당 셀을 `CAFE24_INSTALL_INVALID_HMAC`(403)으로 수정하고, 괄호 안에 "(pending 미발견 포함 — 정보 노출 방지)" 이유 추가.

---

**[INFO]** SQL 마이그레이션 파일 — 주석이 충실하나 `install_token` 컬럼 TTL 정책 미기술
- 위치: `V042__cafe24_private_app_pending_install.sql` L13–L16
- 상세: COMMENT ON COLUMN에 "OAuth callback 완료 후 NULL로 지워진다"는 소멸 시점만 기술. `pending_install` 상태가 무한정 유지될 경우의 정리 정책(예: 스캐너가 N시간 후 삭제하는지 여부)이 명시되지 않음. spec §6 상태 전이도에는 "install timeout / manual delete → 삭제" 경로가 있으나 타임아웃 값이 없음.
- 제안: COMMENT 또는 SQL 블록 주석에 "N시간(미정) 내 callback 없으면 스캐너 삭제 — spec §6 참조" 한 줄 추가하거나, spec §6에 타임아웃 값을 확정하여 기입.

---

**[INFO]** `Cafe24InstallQuery` 인터페이스 — `rawQuery` 필드 목적 주석이 적절
- 위치: `integration-oauth.service.ts` L85–L101
- 상세: `rawQuery` 필드에 "HMAC 검증에 사용" 주석이 있어 왜 raw string을 별도로 전달하는지 의도가 명확함. 양호.

---

**[INFO]** `Cafe24PrivatePendingStep` 컴포넌트 — 내부 로직 주석 없음(적절)
- 위치: `new/page.tsx` L720–L815
- 상세: 간단한 클립보드 복사 + 라우팅 컴포넌트로 복잡한 로직이 없어 주석 부재가 적절함. `copy` 함수의 `void navigator.clipboard` 패턴도 별도 설명 없이 충분히 자명함.

---

**[WARNING]** 영문 문서(`cafe24.en.mdx`) — `Redirect URI` vs `callbackUrl` 혼용
- 위치: `cafe24.en.mdx` §4 Private 앱 흐름 (Step 2 안내 화면 설명)
- 상세: UI 컴포넌트(`Cafe24PrivatePendingStep`)는 두 값을 "App URL"과 "Redirect URI"로 레이블링(`cafe24CallbackUrlLabel`)하나, 영문 문서 §4 Step 2는 "App URL and Redirect URI"로 일치. 그러나 한국어 문서는 같은 위치에서 "App URL 과 Redirect URI"로 표기하고, i18n dict(`cafe24CallbackUrlLabel`)에는 "Redirect URI"로 명시. 표면적으로 일치하지만, `callbackUrl`이라는 prop 이름과 "Redirect URI"라는 레이블이 다르게 보일 수 있음.
- 제안: 문서화 이슈는 아니나, 향후 혼동을 줄이기 위해 prop 이름을 `redirectUri`로 변경하는 것을 고려.

---

**[INFO]** spec 변경 이력(Changelog) — 2026-05-14 항목이 상세하고 정확
- 위치: `spec/4-nodes/4-integration/4-cafe24.md` L451–L454
- 상세: 변경 이력에 재설계 이유("우리 서비스가 OAuth popup을 시작할 수 없고"), 영향 범위(§9.4, §9.8, 신규 엔드포인트, spec 참조 위치)가 모두 기록되어 있어 추적 가능성이 높음.

---

**[INFO]** `needsAttention` 함수 — 인라인 주석 없이 의도 파악 가능
- 위치: `status-badge.tsx` L64–L68
- 상세: `pending_install`에서 `false`를 반환하는 이유(설치 완료 전이므로 경고 불필요)가 코드에서 자명하나, 다른 상태(`expired`, `error`)와의 비대칭이 처음 읽는 사람에게 다소 불명확할 수 있음. 현재 코드 스타일(주석 최소화)에는 부합.

---

**[INFO]** `APP_URL` 환경변수 — 서비스 문서와 코드 간 일관성
- 위치: `integration-oauth.service.ts` L630, `cafe24.en.mdx` 환경변수 표
- 상세: 코드에서 `APP_URL` 환경변수를 사용하지만, 영문/한국어 문서의 환경변수 표에는 `APP_URL`이 누락됨(`CAFE24_CLIENT_ID`, `CAFE24_CLIENT_SECRET`, `OAUTH_STUB_MODE`만 기술).
- 제안: 두 문서의 환경변수 표에 `APP_URL | App URL base (App URL·Redirect URI 구성에 사용. 기본값: http://localhost:3011)` 행 추가.

---

### 요약

이번 변경은 Cafe24 Private 앱의 OAuth 흐름을 근본적으로 재설계한 것으로, **SQL 마이그레이션·엔티티·서비스·컨트롤러·프론트엔드·i18n·spec·문서** 전 계층이 일관되게 갱신되어 문서화 품질이 전반적으로 높다. 특히 spec의 상태 전이도와 API 표, HMAC 알고리즘 명세, 두 언어 사용자 가이드, i18n 문자열이 모두 동기화된 점이 긍정적이다. 다만 **spec API 표의 `CAFE24_INSTALL_NO_PENDING`(404) 에러 코드가 실제 구현(403 통합)과 불일치**하고, **`APP_URL` 환경변수가 문서 환경변수 표에 누락**된 두 가지 항목이 API 연동 개발자에게 혼동을 줄 수 있어 수정을 권장한다.

### 위험도

**LOW** — 기능적 결함은 없고, 문서-구현 불일치가 API 연동 시 오진 가능성을 일부 내포하는 수준.