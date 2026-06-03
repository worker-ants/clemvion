# 보안(Security) 리뷰 결과

대상 커밋: `721e832b` — feat(makeshop): Phase 0 — operation metadata 레이어 (161 REST op)

---

### 발견사항

- **[INFO]** `catalog-sync.spec.ts` — `execSync('git rev-parse --show-toplevel', ...)` 커맨드 실행
  - 위치: `catalog-sync.spec.ts` L429
  - 상세: `execSync` 로 셸 명령을 실행하지만, 인수는 하드코딩된 리터럴 문자열이며 사용자 입력이 개입하지 않는다. 테스트 파일이므로 프로덕션 공격 표면이 없다. `stdio: ['ignore', 'pipe', 'ignore']` 로 stderr 억제를 적절히 설정했고, 실패 시 `catch` 로 폴백한다. 런타임 커맨드 인젝션 위험 없음.
  - 제안: 현재 구조로 안전. 추후 이 패턴을 다른 파일에 복제할 때 사용자 제어 값이 인수에 포함되지 않도록 주의.

- **[INFO]** `catalog-sync.spec.ts` — 파일시스템 경로 조합 (`join(CATALOG_DIR, ...)`)
  - 위치: `catalog-sync.spec.ts` L577
  - 상세: `MAKESHOP_RESOURCES` 는 컴파일 타임 상수(`types.ts` 에서 `as const`)이므로 경로 탐색(path traversal) 공격 표면 없음. 런타임 외부 입력이 경로에 반영되지 않는다.
  - 제안: 영향 없음.

- **[INFO]** `public-meta.ts` — `default?: unknown` 필드가 `PublicMakeshopField` 를 통해 프론트엔드로 노출
  - 위치: `public-meta.ts` L627, `types.ts` L1785
  - 상세: `MakeshopFieldSpec.default` 는 타입이 `unknown` 이다. 현재 어떤 operation 행도 `default` 를 선언하지 않으므로 실질적 위험은 없다. 그러나 향후 `default` 에 예상치 못한 타입(함수, 객체 참조 등)이 실수로 설정될 경우 직렬화 단계에서 예기치 않은 데이터가 클라이언트에 노출될 수 있다.
  - 제안: `default` 를 `string | number | boolean | null | undefined` 같은 직렬화 가능한 스칼라 유니언으로 좁히는 것을 권장한다. `unknown` 유지 필요 시 `buildMakeshopExtras` 직렬화 지점에서 화이트리스트 타입 체크를 추가할 것.

- **[INFO]** `constraint-validator.ts` — 에러 메시지에 필드 이름과 값 반영
  - 위치: `constraint-validator.ts` L869
  - 상세: `impliesValue` 위반 메시지에 `String(c.value)` 로 변환된 트리거 값이 포함된다(`when "${c.if}"="${String(c.value)}"`). `c.value` 는 메타데이터에 하드코딩된 상수(문자열/숫자/불리언)이므로 런타임 사용자 데이터가 아니다. 에러 메시지는 AI 에이전트·핸들러 내부에서 소비되며, 민감 정보가 노출될 리스크는 없다.
  - 제안: 현재 구조 안전. 향후 에러가 외부 HTTP 응답으로 직접 직렬화될 경우 필드 명칭·값 노출 여부를 재점검할 것.

- **[INFO]** `cpik.ts` — SSO 로그인 `redirect_url` / `redirect_fail_url` 필드
  - 위치: `cpik.ts` L1067–1075
  - 상세: `post-cpik_member-login` operation 에 `redirect_url`, `redirect_fail_url` 필드가 있다. 이 필드들은 메타데이터 스키마 정의 레이어(Phase 0)이며, 실제 HTTP 요청을 보내는 런타임 핸들러(Phase 2 이후 구현)가 아직 없다. 런타임에서 이 값을 무검증으로 외부 API 에 전달한다면 Open Redirect 위험이 생긴다.
  - 제안: Phase 2 핸들러 구현 시 `redirect_url` 과 `redirect_fail_url` 에 대해 허용 도메인 화이트리스트 또는 오리진 검증을 추가할 것. 현재 메타데이터 레이어에서는 위험 없음.

- **[INFO]** `cpik.ts` — `post-cpik_member-check` / `post-cpik_member-delete` 의 `scopeType: 'write'` vs. 실질 작업 의미
  - 위치: `cpik.ts` L959, L985, `cpik.md` L2135
  - 상세: `post-cpik_member-check` (연동 여부 확인) 는 조회성 작업임에도 `scopeType: 'write'` 로 분류됐다. 이는 커밋 메시지 및 코드 주석과 일치하는 의도적 결정(MakeShop POST = write)이나, OAuth 스코프 최소권한 원칙 상 과도한 권한 부여가 될 수 있다.
  - 제안: Phase 3 OAuth 구현 시 `check` 류 operation 의 실질 권한 수준을 재검토하고, MakeShop OAuth 문서에서 `read` 스코프로도 호출 가능한지 확인할 것.

---

### 요약

이번 변경은 MakeShop API 의 operation 메타데이터 정적 레이어(Phase 0)를 추가한 것으로, 런타임 HTTP 디스패처·인증 핸들러는 아직 없다. 전체적으로 하드코딩된 시크릿, SQL·커맨드 인젝션, XSS, 인증 우회 등의 실질적 보안 취약점은 발견되지 않았다. `execSync` 사용은 테스트 파일 내 고정 리터럴 인수로 한정돼 안전하다. 향후 런타임 핸들러(Phase 2) 구현 시 `redirect_url` 류 필드의 오픈 리다이렉트 방어와 `default: unknown` 타입 범위 좁히기를 반드시 적용해야 한다.

---

### 위험도

LOW
