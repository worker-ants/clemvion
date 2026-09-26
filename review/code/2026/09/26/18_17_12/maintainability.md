# 유지보수성(Maintainability) 리뷰 — rotate-bot-token-body (2R)

이번 라운드(`18_17_12`)의 diff 는 1R(`17_55_14`)에서 이미 검토된 핵심 코드(3개 라우트에 `@ApiBody` + 문서 전용 DTO 2개 + `swagger-probe.ts` 신규 헬퍼)에, 1R WARNING #1(테스트 리뷰어 지적 — `bodyParamDesignType` 에러 분기 무테스트)을 해소하는 커밋(`fafc6b8ac`, 스타일 수정 `ecaed6534`)과 plan/리뷰 산출물 커밋(`e3fd2b674`, `7d03bdfb1`)이 더해진 상태다. 실제 프로덕션/테스트 코드에 대해 `Read` 로 현재 파일 전문을 직접 확인했다.

## 참고: 리뷰 중 관측한 워킹트리 순간 변화 (본 diff 와 무관, 내 조작 아님)

리뷰 도중 `git status --short` 를 두 번 연속 돌렸는데, 첫 번째 호출에서 `M codebase/backend/src/shared/testing/swagger-probe.ts` 가 잠깐 나타났다가 곧이은 `git diff`/두 번째 `git status --short` 에서는 다시 사라져 클린 상태로 돌아왔다(현재는 `?? review/code/2026/09/26/18_17_12/` 만 남아 있다). 병렬 fan-out 중 다른 reviewer 가 짧게 뮤테이션→cp 원복을 수행한 것으로 보인다. 본 세션은 이 파일에 어떤 Write/Edit 도 하지 않았고(Read 만 수행), 위 발견사항은 모두 `Read` 로 확인한 현재(클린) 파일 내용을 근거로 작성했다.

## 발견사항

- **[INFO]** 캐너리 spec 3~4파일의 4-테스트 템플릿 반복 — 1R WARNING, 의도적 유예 확인
  - 위치: `codebase/backend/src/modules/executions/executions-continue-body.spec.ts:22-68`, `codebase/backend/src/modules/triggers/triggers-rotate-bot-token-body.spec.ts:24-69` (축약형: `codebase/backend/src/modules/hooks/hooks-webhook-body.spec.ts:12-38`)
  - 상세: ① 설계 타입이 `Object` 인지(캐너리) ② 여분 키가 파이프를 통과하는지(캐너리) ③ `@ApiBody` 가 맞는 DTO 를 가리키는지(가드) ④ 스텁 컨트롤러로 렌더한 스키마 검증(렌더) — 이 4단 구조가 엔티티 이름만 바꿔 3곳(`workflows-execute-body.spec.ts` 포함 4곳)에서 반복된다. rule-of-three 기준은 이미 충족했다. 다만 `review/code/2026/09/26/17_55_14/RESOLUTION.md`(W2)가 "각 캐너리 파일이 그 라우트의 계약을 독립적으로 읽히게 하는 것이 목적 — 팩토리로 접으면 실패 메시지가 어느 라우트인지 흐려진다"는 근거로 조치하지 않기로 이미 명시적으로 결정했고, 이번 라운드에서 그 판단을 바꿀 새 근거(예: 5번째 유사 라우트 발생)는 diff 에 없다. 재확인 결과로도 이 판단은 여전히 합리적이라 판단해 등급을 WARNING 에서 INFO 로 낮춘다 — 차단 사유 아님, 다음 유사 라우트 발생 시 재검토 권장이 유효하다.
  - 제안: 추가 조치 불필요(이미 처분됨). 5번째 유사 라우트가 생기면 `describeApiBodyOnlyRoute(...)` 류 공용 factory 재검토.

- **[INFO]** `bodyParamDesignType` 신규 에러 경로 테스트 — 1R WARNING #1 해소 확인(양호)
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.spec.ts:75-120`
  - 상세: `@Body()` 부재 · `@Body()` 2개 · `design:paramtypes` 부재 세 방어 분기를 각각 직접 트리거하는 테스트를 추가했고(`fafc6b8ac`), `design:paramtypes` 부재 케이스는 `Reflect.defineMetadata` 로 라우트 인자 메타데이터만 손으로 실어 데코레이터 미장착 상황을 정확히 재현한다. 전제 테스트("파라미터 순서가 아니라 라우트 인자 메타데이터로 찾는다")도 있어 회귀를 놓치지 않는다. `swagger-probe.ts:164` 의 `controller.prototype as object` 캐스팅도 `no-unsafe-argument` 경고를 없애는 최소 수정(`ecaed6534`)으로 적절하다.
  - 제안: 없음(양호 확인).

- **[INFO]** "문서 전용 DTO" 설계 근거 서사가 파일마다 반복 — 1R INFO, 재확인
  - 위치: `codebase/backend/src/modules/executions/dto/continue-execution.dto.ts:3-10`, `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts:3-11`
  - 상세: 두 DTO 의 `//` 주석이 "전역 `CustomValidationPipe` 는 `Object` metatype 만 검증을 건너뛴다" 는 핵심 근거를 거의 동일한 문장으로 반복한다(선례 `execute-workflow.dto.ts` 포함 3벌째). 설계 결정이 바뀌면 여러 파일을 찾아 고쳐야 하는 비용이 있으나, JSDoc/`//` 분리(`swagger.md` §3 준수)는 선례보다 개선됐고 각 파일이 그 라우트에 고유한 계약 변화(`INVALID_BOT_TOKEN` vs 여분 키)를 함께 설명하고 있어 단일 출처로 모으면 오히려 맥락이 흐려질 수 있다. 차단 사유 아님.
  - 제안: 조치 불필요. 후속으로 핵심 근거를 `CustomValidationPipe` JSDoc 한 곳에 두고 각 DTO 는 인용만 하는 안을 고려할 수 있으나 우선순위 낮음.

- **[INFO]** Nest 비공개 내부 export(`ROUTE_ARGS_METADATA`, `RouteParamtypes`) 의존 — 1R INFO, 완화 확인
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts:9-10`, `:142-143`
  - 상세: JSDoc(`:142-143`)에 "Nest 메이저 업그레이드로 키 형식이 바뀌면 이 헬퍼의 에러 경로 테스트가 먼저 깨진다" 가 이미 명시돼 1R 제안(다음 업그레이드 담당자를 위한 메모)이 반영됐다. 테스트 파일(`.spec.ts`)에서만 쓰이고 `tsconfig.build.json` 이 `src/shared/testing/**` 를 빌드 제외에 명시하고 있어(파일 헤더 주석 확인) 프로덕션 dist 오염 위험도 없다.
  - 제안: 없음(양호 확인).

## 요약

이번 2R diff 는 1R 에서 검토된 좁고 잘 문서화된 변경(3 라우트 `@ApiBody` + 문서 전용 DTO 2개 + 공용 프로브 헬퍼 `bodyParamDesignType`)에 1R WARNING(에러 분기 무테스트)을 해소하는 테스트 보강만 더한 것으로, 새로운 유지보수성 결함을 도입하지 않는다. 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 모두 문제 없고, 네이밍은 `bodyArgs` 로 이미 개선됐다. 유일하게 남아 있는 항목(캐너리 4-테스트 템플릿 반복)은 이미 이전 라운드에서 근거를 갖춰 의도적으로 유예된 상태이며 이번 라운드에서 그 판단을 뒤집을 근거가 없어 INFO 로 하향해 기록한다. CRITICAL/WARNING 급 신규 결함 없음.

## 위험도

LOW
