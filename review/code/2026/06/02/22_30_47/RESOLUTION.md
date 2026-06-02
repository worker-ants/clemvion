# Resolution — npm audit 의존성 업그레이드 리뷰 대응

대상 리뷰: `SUMMARY.md` (RISK=MEDIUM, CRITICAL=0, WARNING=2)
대상 커밋: `58293592 fix(deps): npm audit 취약점 전체 해소`
처리 방식: **수동 조치 + 검증** (코드 수정 불요 — 두 WARNING 모두 "검증 필요" 성격으로, 검증 결과 실제 문제 없음으로 판명)

## Critical
없음.

## WARNING 처리

### W1 — uuid override v11 → v13 메이저 점프의 TypeORM 호환성 — ✅ 검증 완료, 문제 없음

**판정**: 호환됨. override 유지.

근거:
- `typeorm@0.3.28` 은 uuid 를 `^11.1.0` 으로 선언하고, 실제 사용 API 는 **`uuid_1.v4` (v4 함수) 단일** (`grep` 으로 typeorm compiled 코드 전수 확인 — `v4` 외 다른 export 미사용, `buf` 인자 미사용).
- uuid v13 에서 `v4` 는 동일하게 함수로 존재하며 (`typeof u.v4 === 'function'` 확인), `v4()` 출력은 v9/v11 과 동일한 RFC4122 v4 형식 (정규식 검증 통과).
- 해당 권고(GHSA-w5hq-g745-h8pq)는 **v3/v5/v6 에 `buf` 인자를 줄 때의 버퍼 경계 미검사** 문제로, typeorm 의 `buf` 없는 `v4()` 호출과 무관.
- `@PrimaryGeneratedColumn('uuid')` 등 엔티티 PK 생성 경로 포함 backend unit test **288 suites / 5,518 tests 전량 통과** (uuid 13 적용 상태). mail/notification/template 169 tests 별도 통과.

### W2 — vitest 3.2.4 → 4.1.8 메이저 업그레이드 (Node 20+, chai v6 등) — ✅ 검증 완료, 문제 없음

**판정**: 안전. 업그레이드 유지.

근거:
- Node 최소 버전: `channel-web-chat/package.json` `engines.node: ">=20"`, web-chat CI(`/.github/workflows/web-chat-checks.yml`) `node-version: '24'` — vitest 4 요구사항(Node 20+) 충족.
- `vitest run` 전량 통과: **10 files / 112 tests** (vitest 4.1.8, 2회 재실행 모두 green). chai v6 assertion·spy/mock 내부 구조 변경에 따른 회귀 없음.
- `tsc --noEmit` typecheck 통과.

## INFO 항목 처리

- **INFO 1 (ws/engine.io/qs/brace-expansion 보안 패치)**: 의도된 변경. 3개 프로젝트 `npm audit` 0건 확인.
- **INFO 3 (mailer 하위 chokidar/glob-parent/readdirp dedup)** + **INFO 5 (liquidjs 10.25.7→10.27.0)**: `mail.service.spec.ts`·`notification-dispatcher.service.spec.ts` 포함 12 suites / 169 tests 통과 — 메일 전송·템플릿 로딩 회귀 없음.
- **INFO 2/4 (chokidar/uglify-js `dev`→`devOptional` 플래그)**: optional 분류 변경. 운영 이미지는 해당 패키지 불요 — 영향 없음.
- **INFO 7 (preview-email uuid 9.0.1 제거)**: 상위 uuid ^13 으로 통합. preview-email 은 dev 프리뷰 용도 — 런타임 영향 없음.
- **INFO 8~11 (문서화: override/CVE 목적 기록)**: 커밋 `58293592` 본문에 (a) 해소한 audit 항목·CVE, (b) liquidjs/uuid override 목적, (c) postcss override 목적, (d) vitest 4 업그레이드를 모두 기록하여 대응. 별도 CHANGELOG 미운용 프로젝트.
- **INFO 12/13 (postcss·es-module-lexer)**: vitest 내부 전용 — 애플리케이션 영향 없음.

## 최종 검증 (TEST WORKFLOW 재수행)

| 프로젝트 | 결과 |
|---|---|
| backend | `npm audit` 0건 / `npm run build` 통과 / unit 288 suites·5,518 tests 통과 (mail/notification/template 169 별도 재확인) |
| frontend | `npm audit` 0건 / `npm run build` 통과 |
| channel-web-chat | `npm audit` 0건 / `tsc --noEmit` 통과 / `vitest run` 112 tests 통과 (vitest 4.1.8) |

## 결론
WARNING 2건은 모두 검증 결과 **실제 위험 없음** — 코드/의존성 추가 수정 불요. ESCALATE 없음.
