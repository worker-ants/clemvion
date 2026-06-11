# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 의존성 위생(security hygiene) 조치 2건(jsonwebtoken devDeps→deps 재분류, hono override 상향)으로 구성된 codeless 변경. Critical 발견 없음. 문서화 미비 2건(INFO 수준) 외 이상 없음.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | hono override 하한선 `^4.12.21` — CVE 패치 확보, 단 backend가 MCP client로만 hono를 전이 사용하는 구조에서 JWT middleware bypass CVE와 실제 인증 흐름의 논리적 독립성을 코드 레벨에서 재확인 권장 | `package.json` overrides 섹션, `package-lock.json` L63–65 | 현재 조치 유지. 코드 레벨 독립성 확인 후 무결 시 완전 해소 가능 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/의존성 | `jsonwebtoken` 9.0.3 devDeps→deps 이동. 프로덕션 빌드(`npm prune --omit=dev`) 후 fragile 전이 의존 해소. 9.0.3에 알려진 CVE 없음 | `package.json` L62, `package-lock.json` L35 | 현재 조치 유지. 장기적으로 `@nestjs/jwt` JwtService 단일 경로 리팩토링 백로그 유지 |
| 2 | 보안/의존성 | `jsonwebtoken` exact pin(`"9.0.3"`, caret 없음) — 보안 민감 패키지에 수용 가능한 선택이나 향후 패치 시 수동 업데이트 필요 | `package.json` L62 | exact pin 유지 시 보안 패치 대응 절차 팀 내 공유 필요 |
| 3 | 보안/의존성 | `jsonwebtoken`과 `@nestjs/jwt` 중복 JWT 처리 경로 잠재 존재. `@nestjs/jwt`는 내부적으로 `jsonwebtoken` 래핑 | `package.json` runtime deps | 장기 백로그: `@nestjs/jwt` JwtService 단일 경로 통합 리팩토링 |
| 4 | 보안/의존성 | `interaction-token.service.ts`의 `jsonwebtoken` 직접 API 사용 시 `algorithms` 옵션 지정 여부 미확인 (`none` 알고리즘 허용 가능성) | `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` | 별도 소스 코드 리뷰 시 `algorithms` 옵션 지정 여부 확인 |
| 5 | 보안/의존성 | `chokidar`(4.0.3), `readdirp`(4.1.2) `devOptional`→`dev` 재분류 — lock 재생성 과정의 npm 자동 리솔브 결과. 프로덕션 트리 영향 없음 | `package-lock.json` L51–52, L73–74 | 별도 조치 불필요 |
| 6 | 문서화 | `package.json` overrides 섹션에 hono CVE 배경(4건, `>=4.12.21` 패치) 인라인 주석 없음. JSON은 주석 불가 구조 | `package.json` overrides 섹션 | 커밋 메시지·PR description에 CVE 번호 명시, 또는 `DEPENDENCIES.md` 추가로 트레이서빌리티 확보 |
| 7 | 문서화 | CHANGELOG.md에 보안 패치 항목(hono CVE 4건 해소, jsonwebtoken 재분류) 미반영 | `CHANGELOG.md` Unreleased 섹션 | Unreleased 섹션에 한 줄 항목 추가 권장. 외부 공개 릴리스 노트만 관리하는 관례라면 생략 허용 |
| 8 | 의존성 | `undici ^6.21.3` — 6.x 계열 SSRF 관련 이슈 이력. 현재 버전 기준 알려진 활성 CVE 없음 | `package.json` | 모니터링 유지 권장 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | hono override 패치 확보(WARNING 1건). 그 외 jsonwebtoken 9.0.3 CVE 없음, 전반적 보안 수준 유지 |
| dependency | LOW | jsonwebtoken devDeps→deps 이동 적절. exact pin 방식 수용 가능. hono 4.12.25 resolve 확인 |
| documentation | LOW | package.json override 사유 주석 없음, CHANGELOG 미갱신 (INFO 2건, 기능 정확성 무관) |
| side_effect | NONE | 소스 코드·API·환경변수·이벤트·네트워크 경로 중 어느 것도 변경 없음. 부작용 없음 |

## 발견 없는 에이전트

- **side_effect**: 부작용 관점 이상 없음 (NONE 위험도)

## 권장 조치사항

1. (필수 아님, 권고) `interaction-token.service.ts`의 `jsonwebtoken` 직접 호출 코드에서 `algorithms` 옵션 명시 여부를 확인해 `none` 알고리즘 허용 위험을 제거한다.
2. (선택) PR description 또는 커밋 메시지에 hono CVE 번호(IP restriction bypass, Set-Cookie injection, JWT middleware bypass, path routing bypass, `>=4.12.21` 패치)를 명시해 트레이서빌리티를 확보한다.
3. (선택) CHANGELOG.md Unreleased 섹션에 보안 패치 항목을 한 줄 추가한다.
4. (장기 백로그) `jsonwebtoken` 직접 사용을 `@nestjs/jwt` JwtService 단일 경로로 통합 리팩토링한다.
5. (장기 백로그) `plan/in-progress/refactor/07-dependency.md` m-6 항목에 "hono 사유는 deps-security-hygiene PR에 기록됨" 참조를 추가해 분산 기록 연결고리를 명시한다.

## 라우터 결정

라우터 선별 실행 (`routing_status=done`).

- **실행** (4명): `security`, `side_effect`, `documentation`, `dependency`
- **강제 포함 (router_safety)** (2명): `dependency`, `documentation`
- **제외** (10명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 소스 코드 변경 없는 의존성 선언 변경으로 성능 분석 대상 없음 |
| architecture | 아키텍처 변경 없음 |
| requirement | 기능 요건 변경 없음 |
| scope | 범위 명확 (의존성 2건 조치) |
| maintainability | 소스 코드 미변경으로 유지보수성 분석 대상 없음 |
| testing | 테스트 코드 변경 없음 |
| database | DB 스키마·쿼리 변경 없음 |
| concurrency | 동시성 관련 코드 변경 없음 |
| api_contract | 공개 API 변경 없음 |
| user_guide_sync | 사용자 가이드 변경 필요 없음 |