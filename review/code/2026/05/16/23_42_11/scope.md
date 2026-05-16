# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `backend/package-lock.json` — `@nestjs-modules/mailer` 하위 `chokidar`, `glob-parent`, `readdirp` 3개 항목 추가
  - 위치: `backend/package-lock.json` lines 345-412
  - 상세: `protobufjs`/`fast-uri` overrides(C-13) 설치 결과로 lock 파일 재생성 시 `@nestjs-modules/mailer` 의 옵셔널 peer dep 트리가 함께 변경되었다. 이 항목들은 명시된 변경 의도(C-13 CVE 해소)의 부수 효과로, `npm install` 결과물이므로 직접 조작한 것은 아니다. overrides 적용이 전이적으로 mailer 패키지 트리에도 영향을 준 것이며, 의도된 범위 밖의 코드 영역이지만 자동 생성 파일 특성상 불가피하다.
  - 제안: 별도 조치 불필요. `optional: true, peer: true` 로 표기되어 있어 기능 영향 없음.

- **[INFO]** `backend/package-lock.json` — `uglify-js` 항목에 `"dev": true` 속성 추가
  - 위치: `backend/package-lock.json` line 501
  - 상세: lock 파일 재생성 시 `uglify-js` 의 devDependency 분류가 갱신되었다. C-13 외의 변경 의도에서 명시되지 않은 항목이지만 lock 파일 자동 재생성의 결과물이다.
  - 제안: 별도 조치 불필요.

- **[INFO]** `backend/src/common/dto/pagination.dto.ts` — `@MaxLength(64)` 데코레이터 추가
  - 위치: `pagination.dto.ts` line 637 (`@MaxLength(64)`)
  - 상세: W-46 은 `@Matches` 검증 패턴 추가를 목표로 했으나 `@MaxLength(64)` 가 함께 추가되었다. 커밋 메시지에 W-46 설명에 명시("MaxLength(64)" 포함)되어 있어 의도된 변경이며, 보안 관점상 길이 제한은 `@Matches` 와 함께 필요한 방어 조치다. 과잉 변경이 아닌 연관 보안 강화로 판단된다.
  - 제안: 현행 유지.

- **[INFO]** `backend/src/modules/integrations/services/credentials-transformer.ts` — 로그 메시지 문자열 내 `[integrations]` 프리픽스 제거
  - 위치: `credentials-transformer.ts` lines 428, 441
  - 상세: W-31(`console.warn` → NestJS Logger 교체) 수행 중, 기존 메시지에서 `[integrations]` 접두어가 삭제되었다. NestJS Logger 는 컨텍스트 이름(`'IntegrationCredentialsTransformer'`)을 자동으로 prefix 로 출력하므로 중복 제거는 합리적이다. 그러나 메시지 내용의 변경은 순수 console 교체 범위를 약간 초과한다.
  - 제안: 허용 가능한 수준. 로그 포맷이 개선되었으며 기능 변경 없음.

- **[INFO]** `packages/expression-engine/README.md`, `packages/node-summary/README.md` — 신규 파일 생성
  - 위치: `packages/expression-engine/README.md` (41줄), `packages/node-summary/README.md` (61줄)
  - 상세: W-79 로 명시적으로 계획된 변경이다. 기존에 README 가 없던 패키지에 문서를 추가한 것이며 변경 범위에 포함되어 있다.
  - 제안: 현행 유지.

- **[INFO]** 다수의 `spec/*.md` 파일 — 앵커 링크 동기화 (C-7, C-14, C-15)
  - 위치: `spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/4-integration.md`, `spec/3-workflow-editor/4-ai-assistant.md`, `spec/4-nodes/3-ai/0-common.md` 외 다수
  - 상세: `#23-internal-bridge` → `#23-internal-bridge-in-process` 앵커 일괄 치환은 C-7 명시 작업이다. 텍스트 변경 없이 URL 앵커만 수정되었으며 각 파일에서 정확히 해당 링크 1~2개만 변경되었다.
  - 제안: 현행 유지.

## 요약

본 커밋은 코드 리뷰 산출물(`plan/in-progress/20260516-full-review/SUMMARY.md`)에 명시된 Critical 7건·Warning 15건을 정확히 처리하였으며, 각 변경은 커밋 메시지에 항목 단위로 대응된다. 의도 이상의 리팩토링, 무관한 기능 추가, 불필요한 포맷팅·주석 변경은 관찰되지 않는다. `backend/package-lock.json` 의 자동 재생성 부수효과(mailer 하위 peer dep 추가, `uglify-js` `dev` 속성 갱신)가 명시적 의도 범위를 살짝 벗어나 있으나, `npm install` 의 결정론적 결과물로 직접 조작이 아니며 기능 영향 없다. `credentials-transformer.ts` 에서 로그 메시지 접두어가 제거된 점도 Logger 교체 작업의 자연스러운 연장선이다. 전체적으로 변경 범위는 매우 절제되어 있으며 over-engineering이나 무관 수정의 징후는 없다.

## 위험도

NONE
