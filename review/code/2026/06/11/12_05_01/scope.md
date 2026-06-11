# 변경 범위(Scope) 리뷰

## 발견사항

### 파일 1: codebase/backend/README.md

- **[INFO]** README 배포 주의 항목 확장 — 범위 내 정당한 수정
  - 위치: 라인 52-57 (diff 기준)
  - 상세: 기존 단일 문장(`JWT_SECRET`·`ENCRYPTION_KEY`·`MCP_ALLOW_INSECURE_URL` 언급)을 불릿 목록으로 분리하고 `OAUTH_STUB_MODE`, `LLM_STUB_MODE`, `JWT_SECRET<32` 조건을 추가. 커밋 메시지에 명시된 INFO1/2/10 반영 항목으로, 실제 `assertProductionConfig` 거부 조건과의 정합을 맞추는 문서 수정이다. 의도된 작업 범위(fail-closed 가드 테스트 및 문서 정확화) 안에 포함된다.
  - 제안: 없음.

### 파일 2: codebase/backend/src/common/config/production-guards.spec.ts

- **[INFO]** `beforeAll` 로 `.env.example` 읽기 이동 — 범위 내 정당한 수정
  - 위치: 라인 155-164 (diff 기준), `describe('blacklist Set sync …')` 내부
  - 상세: describe 최상위의 동기 `readFileSync` 호출을 `beforeAll` 훅으로 이동. 커밋 메시지의 W2(side-effect/testing) 지적에 대한 직접적 수정이며, 이전 리뷰(`11_53_22 incremental`) 에서 제기된 테스트 취약성 해결이다. 범위를 이탈하지 않는다.
  - 제안: 없음.

- **[INFO]** `it('INSECURE_JWT_SECRETS contains the jwt.config.ts dev fallback')` 주석 수정 — 범위 내 정당한 수정
  - 위치: 라인 172-177 (diff 기준)
  - 상세: `registerAs` 래퍼 동작을 오해한 구 주석을 정정. 커밋 메시지 INFO7 반영이며, 테스트 로직 변경 없이 주석만 정확화. 불필요한 주석 변경이 아니라 오해를 유발하는 내용을 수정하는 것으로, 범위 내 허용 수정이다.
  - 제안: 없음.

## 요약

이번 커밋은 이전 incremental 리뷰(`11_53_22`)의 지적 사항을 반영하는 fix 커밋이다. 변경은 세 가지로 한정된다: (1) 테스트 fragility 개선(`beforeAll` 이동), (2) 잘못된 주석 정정, (3) README의 배포 주의 조건 문서화 정확화. 세 변경 모두 커밋 메시지에 사전 명시되어 있으며, fail-closed 가드 작업의 직접적 후속 조치다. 관련 없는 파일 수정, 불필요한 리팩토링, 기능 확장, 임포트·설정 변경은 없다. 변경 범위 이탈 없음.

## 위험도

NONE
