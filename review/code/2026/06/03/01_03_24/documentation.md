# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] `system-status.constants.ts` — 신규 환경변수 2개가 `.env.example`에 누락되어 있을 가능성
- 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` 라인 231–234
- 상세: spec(`16-system-status-api.md §3`)에서 `SYSTEM_STATUS_FAILED_THRESHOLD`, `SYSTEM_STATUS_DELAYED_THRESHOLD`를 명시하고 코드에서도 동일 이름을 사용한다. 그러나 신규 환경변수가 `backend/.env.example`에 추가되었는지 확인이 필요하다. 기본값(각각 1, 50)이 코드에 하드코딩되어 있어 누락 시 기능 자체는 정상 작동하지만, 운영자가 조정 가능한 변수임을 인지하지 못하게 된다.
- 제안: `backend/.env.example`에 두 변수와 기본값 및 설명 주석을 추가한다.

---

### [INFO] `system-status.module.ts` — 휘발성 리뷰 참조 인라인 사용
- 위치: `codebase/backend/src/modules/system-status/system-status.module.ts` 라인 322
- 상세: 모듈 클래스 주석이 `(Redis 연결 수 통합 정책 — ai-review INFO-12 맥락)` 형태로 특정 리뷰 세션 ID를 참조하고 있다. 이 참조는 시간이 지나면 찾기 어렵다. 주석 자체는 sharedConnection 이유를 충분히 설명하고 있어 실용적 문제는 없다.
- 제안: "ai-review INFO-12" 대신 커밋 해시(fc47096a) 또는 spec 경로를 참조하면 더 영속적이다. 필수 아님.

---

### [INFO] `system-status.service.ts` — `computeUtilization` private 메서드에 인라인 설명 없음
- 위치: `codebase/backend/src/modules/system-status/system-status.service.ts` 라인 666–669
- 상세: 인접한 `deriveHealth`에는 상세 JSDoc이 있으나 `computeUtilization`은 로직(`Math.round(...*100)/100`)에 대한 설명 없이 구현만 있다. 이 패턴이 "소수 2자리 반올림"임을 한 줄 주석으로 표시하면 의도 파악이 용이해진다.
- 제안: `// active / concurrency; concurrency=0 guard; 소수 2자리 반올림` 한 줄 주석 추가. 필수 아님.

---

### [INFO] 프론트엔드 `page.tsx` — `extractData` helper 함수에 목적 주석 없음
- 위치: `codebase/frontend/src/app/(main)/system-status/page.tsx` 라인 906–909
- 상세: `extractData<T>`가 `{ data: T }` envelope을 처리하는 이유(TransformInterceptor `{data}` 래핑 대응)가 코드에 표현되어 있지 않다. 두 경로(`d.data ?? d`)의 필요성도 불명확하다.
- 제안: 함수 위에 `/** API 응답 envelope({data:T}) 또는 raw T 를 모두 수용. TransformInterceptor {data:...} 래핑 대응. */` 주석 추가. 필수 아님.

---

### [INFO] `spec/2-navigation/_product-overview.md` — NAV-SS-* 요구사항 상태가 구현 후에도 "🚧(계획)"으로 남아 있음
- 위치: `spec/2-navigation/_product-overview.md` NAV-SS-01 ~ NAV-SS-06 행
- 상세: `plan/in-progress/system-status-page.md` 체크리스트 기준으로 구현이 완료된 상태이며, `spec/2-navigation/15-system-status.md` frontmatter도 `status: implemented`로 승격되었다. 그러나 `_product-overview.md`의 요구사항 상태 칸이 모두 "🚧(계획)"으로 남아 있어 다른 완료 요구사항(✅ 표기)과 불일치한다.
- 제안: NAV-SS-01 ~ NAV-SS-06 상태를 ✅로 갱신한다. 후속 spec-coverage 감사에서 갭으로 보고될 수 있으므로 권장.

---

### [INFO] `spec/5-system/_product-overview.md` — NF-OB-06 상태가 "🚧 (계획)"으로 남아 있음
- 위치: `spec/5-system/_product-overview.md` NF-OB-06 행
- 상세: NAV-SS-* 와 동일한 이슈. 구현 완료 후 상태 갱신이 필요하다.
- 제안: `🚧 (계획 — ...)` → `✅ (구현 완료 — GET /api/system-status/overview + /system-status 페이지)`로 갱신.

---

### [INFO] `spec/2-navigation/_layout.md` — Marketplace 배치 예정 주석이 System Status 삽입 이후 부정확해짐
- 위치: `spec/2-navigation/_layout.md` 라인 3055 (`<!-- 로드맵 — Marketplace는 아직 미구현이며, 구현 시 Statistics 아래에 배치한다. -->`)
- 상세: System Status(10번)가 Statistics(9번) 바로 다음에 삽입되었으므로 "Statistics 아래" 표현이 이제는 System Status 다음(11번 위치)을 의미하게 되었다. 표현 자체는 여전히 대략적으로 맞으나 11번 User Guide가 이미 그 위치를 차지하고 있어 Marketplace 예정 위치가 모호해졌다.
- 제안: 주석을 "구현 시 System Status(10) 이후에 배치한다"로 갱신. 낮은 영향도이나 spec 정확성 차원에서 권장.

---

## 요약

이번 변경은 시스템 상태 페이지 신규 추가로서 문서화 품질이 전반적으로 우수하다. 백엔드의 공개 클래스·인터페이스·상수에 JSDoc 및 클래스 레벨 주석이 충실히 작성되어 있고, health 파생 로직(`deriveHealth`)에는 spec §3 규칙을 직접 참조하는 상세 주석이 있다. spec 문서(`16-system-status-api.md`, `15-system-status.md`)는 3섹션 구조(Overview / 본문 / Rationale)를 준수하며 R-1~R-4 결정 근거가 명확히 기술되어 있다. API 컨벤션, RBAC 매트릭스, health 어휘 설명, observability 흐름 등 연관 spec 동기화도 모두 수반되어 cross-spec 문서 일관성이 잘 유지된다. 주요 개선 기회는 (1) `backend/.env.example`에 신규 환경변수 2개 추가, (2) 구현 완료 후 `_product-overview.md` 내 NAV-SS-* 및 NF-OB-06 상태 ✅ 갱신, (3) `_layout.md` Marketplace 배치 주석 소폭 수정이다. 이들은 모두 INFO 등급이며 구현 차단 사유가 없다.

## 위험도

LOW

STATUS: SUCCESS
