# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] spec-link-integrity.test.ts 타임아웃 추가 — 직접 목적과 무관하지만 무해한 부속 수정
- 위치: `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` (파일 9)
- 상세: 이번 작업 목적(1MB body 게이트 + 공개 webhook 보호 버그 수정)과 직접 관련이 없다. 그러나 파일 주석이 명시하듯 "spec 스캔이 CPU 경합 시 5s 기본 타임아웃을 초과해 flaky 실패"를 막는 방어적 수정이다. 코드 동작을 바꾸지 않고 테스트 타임아웃만 30_000ms 로 상향한다. 실질 동작 변경 없음에 가까운 수준으로 범위 일탈 위험이 낮다.
- 제안: 별도 커밋으로 분리하는 것이 이상적이나, 크기와 위험도가 낮아 현 PR 포함이 허용 범위다.

### [INFO] GlobalExceptionFilter 의 http-errors 4xx 매핑 — 413 외 4xx 전체에 적용
- 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` (파일 5), `errStatus >= 400 && errStatus < 500` 조건 블록
- 상세: 413(`PAYLOAD_TOO_LARGE`) 지원이 목적이나, 구현은 `errStatus >= 400 && errStatus < 500` 전체를 `getCodeFromStatus` 로 매핑한다. 즉 body-parser 외의 다른 http-errors 라이브러리가 throw 하는 4xx(예: 401, 403, 404)도 이 경로로 진입할 수 있다. 실제로 이 else 분기까지 도달하는 http-errors 4xx 는 body-parser 의 413 이 주이며(NestJS HttpException 은 첫 번째 분기에서 처리됨), 의도치 않은 행동 변경 위험은 낮다. 명시적 413 처리만 원했다면 `errStatus === 413` 조건으로 좁힐 수도 있었으나 현재 구현은 방어적 접근으로 올바른 선택이다.
- 제안: 현재 구현은 허용 범위. 단, 추후 다른 http-errors 미들웨어가 추가될 때 의도치 않게 이 경로를 탈 수 있으므로 팀 인식이 필요하다.

### [INFO] plan 파일 체크박스 업데이트 — 범위 내 필수 추적 문서 갱신
- 위치: `plan/in-progress/spec-sync-webhook-gaps.md` (파일 10)
- 상세: `- [ ]` → `- [x]` 로 구현 완료 마킹. CLAUDE.md 규약에서 plan 체크박스 갱신은 구현 커밋에 포함해야 한다. 범위 내 필수 변경.

### [INFO] spec 3파일 갱신 — 모두 구현과 직결된 "Planned → 구현" 반영
- 위치: `spec/5-system/12-webhook.md`, `spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md` (파일 11–13)
- 상세: 12-webhook.md 는 WH-NF-02 상태를 "Planned" → 구현 세부사항으로 교체하고 §3.1·§6·§8 를 동기화. api-convention.md 는 §5.3 기본코드 표와 §6 HTTP 상태코드 표에 413 행 추가. error-handling.md 는 §1.3 에 `PAYLOAD_TOO_LARGE` 등재. 세 문서 모두 이번 구현이 직접 요구하는 "implemented" 반영이며 별도 기능 확장이 아니다.

## 요약

13개 변경 파일 모두 "인증 webhook 1MB body 게이트(WH-NF-02 옵션 C) + 공개 webhook 보호 우회 버그 수정"의 의도와 직결된다. 신규 파일(`hooks-body-parser.ts/.spec.ts`, `http-exception.filter.spec.ts`)은 핵심 구현 및 단위 테스트이고, `main.ts`·`public-webhook-throttle.guard.ts`·e2e 테스트 추가는 이 기능의 필수 변경이다. spec 3개 파일과 plan 파일 갱신은 SDD 규약상 의무 동기화다. `GlobalExceptionFilter` 에서 4xx 전체를 매핑하는 방식은 목표(413 처리)보다 조금 넓지만 의도적이고 안전한 구현 선택으로 범위 일탈이 아니다. `spec-link-integrity.test.ts` 의 타임아웃 상향은 이번 목적과 무관하지만 변경 규모가 1줄로 매우 작고 테스트 안정성 개선이라 허용 범위다. 전체적으로 의도 이상의 변경, 불필요한 리팩토링, 기능 확장, 무관한 수정, 포맷팅·주석·임포트·설정 변경은 없다.

## 위험도

NONE
