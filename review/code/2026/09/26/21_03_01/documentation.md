# 문서화(Documentation) 리뷰 — integration-test-contract

## 발견사항

- **[INFO]** `TestConnectionResultDto.preview` 와 형제 `PreviewTestResultDto.preview` 의 JSDoc 문구가 다르다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:518` (`/** MCP service_type 한정 — 성공 시 capability 미리보기 */`) vs 같은 파일 `:279` (`/** MCP service_type 한정 — 등록 UI 의 capability 미리보기 */`, 기존 선언, 이번 diff 밖)
  - 상세: `capabilities` · `serverInfo` 두 필드는 두 DTO 간 JSDoc 문구가 완전히 동일한데, `preview` 만 "성공 시" vs "등록 UI 의" 로 갈린다. plan(`plan/in-progress/integration-test-contract.md` §뮤턴트 표 아래 설명)이 스스로 "jest 에는 swagger CLI 플러그인이 없으므로 JSDoc 문구 차이는 대조 대상이 아니다" 라고 명시해 두었으므로 의도적 방임으로 보이며, 두 엔드포인트의 호출 맥락(사후 연결 테스트 vs 등록 전 미리보기)이 다르다는 점에서 문구가 갈리는 것 자체가 틀린 것은 아니다. 다만 "선언은 `PreviewTestResultDto` 와 **같게** 한다" 는 방향성 문장(plan §방향-1, DTO 파일 493-497행 주석)을 읽는 다음 사람이 "완전히 동일 문구"를 기대하고 대조하다 혼동할 수 있다.
  - 제안: 차단 사유 아님. 문구를 통일하거나("성공 시" 로 맞추거나), 혹은 의도적으로 다르다면 DTO 주석에 "JSDoc 문구는 대조 대상이 아니며 맥락에 따라 다를 수 있다" 한 줄을 덧붙이면 다음 사람의 혼동을 줄인다.

- **[INFO]** 신규 와이어 테스트 docblock의 "자매와 같은 틀" 표현이 실제 파일 구조 차이를 가릴 수 있다
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.wire.spec.ts:27` (`* \`llm-model-config.controller.spec.ts\` 의 \`POST /model-configs/:id/test\` describe 와 같은 틀이다.`)
  - 상세: 이 표현은 테스트 **접근 방식**(진짜 서비스 + 최소 mock, 봉투까지 태우는 supertest 왕복)이 자매와 동일하다는 뜻으로는 정확하다. 그런데 실제 자매 구현은 별도 파일이 아니라 기존 `llm-model-config.controller.spec.ts` 안의 `describe` 블록 추가였다(`review/consistency/2026/09/26/20_32_24/naming_collision.md` 가 이미 동일 지점을 INFO 로 짚음). 이 모듈은 접미사 없는 기본 `integrations.controller.spec.ts` 자체가 없는 상태에서 `owner`/`wire` 두 접미사 파일로 쪼개지는 첫 사례가 된다. docblock 문구만 읽으면 "파일 구조까지 자매와 같다"고 오인할 소지가 있다.
  - 제안: 차단 사유 아님(이미 impl-prep 단계에서 INFO 로 검토·수용됨). docblock 에 "파일은 분리했다(이 모듈엔 관점별 접미사 파일이 관례라서)" 한 문장만 보태면 오인 소지가 사라진다.

## 잘 되어 있는 점 (참고)

- `CHANGELOG.md` 신규 항목(26-33행)이 `CHANGELOG.md` 상단 기준(“OpenAPI 로 광고하는 계약의 변화”)에 정확히 부합하고, 실제 diff(필드 3종 선언 추가·컨트롤러 설명 정정)와 내용이 일치한다. 새 항목을 최상단에 추가한 것도 파일 상단 컨벤션("새 항목은 맨 위에")과 일치.
- `integrations.controller.ts` 의 `@ApiOkWrappedResponse` 설명 정정(“메타 정보” → “실패 시 분류 코드, MCP 성공 시 capability 미리보기”)이 DTO 의 실제 필드 변화와 정확히 대응한다. 오래된 주석을 새 코드에 맞게 갱신한 사례.
- `integration-response.dto.ts` 에서 이제 필요 없어진 예고 주석(“MCP 전용 필드도 미선언이지만 … 별도 등재했다”)을 삭제하고, 그 자리에 실측 근거·형제 DTO 참조·설계 이유(열린 맵을 쓰는 이유)를 담은 새 주석으로 교체한 것이 CLAUDE.md 가 강조하는 "plan 서술은 철회로 거짓이 될 수 있다" 교훈을 정확히 실천한 사례다.
- `integrations.service.spec.ts` 의 기존 "성공 경로에는 아직 걸 수 없다" 예고 주석도 새로 추가된 케이스를 가리키는 문장으로 정확히 갱신됐다(오래된 주석 없음).
- 새 와이어 스펙(`integrations.controller.wire.spec.ts`)의 클래스 docblock이 "왜 이 대조가 필요한가" · "무엇이 진짜이고 무엇이 mock 인가" · "왜 MCP 테스터까지 진짜로 두는가"를 명시적으로 설명해 예제 코드로서의 가치도 높다.
- `plan/in-progress/integration-test-contract.md` 는 실측 근거, 방향, 뮤턴트 표(예측/실측 분리), impl-prep 처분까지 3단 구성을 모두 갖춰 완결적이다. 트래커 항목 종결(`- [ ] 트래커 두 항목 닫기`)은 의식적으로 이번 커밋 이후로 미뤄져 있고 그 사실이 체크리스트에 명시돼 있어 은닉된 미완료가 아니다.
- 새 환경변수·설정 옵션 없음 — 해당 사항 없음. README 갱신 필요한 신규 기능(사용자 대면) 없음 — 해당 사항 없음.

## 요약

이번 diff는 문서화 관점에서 전반적으로 우수하다. CHANGELOG 항목이 정확한 기준(OpenAPI 계약 변화)에 맞게 새로 추가됐고, 기존 주석 중 이번 변경으로 낡아진 것들은 모두 갱신되었으며, 새 DTO 필드에는 JSDoc이 형제 DTO와 거의 동일하게 붙었다. 새 테스트 파일의 docblock은 rationale까지 담아 예제 코드 역할도 겸한다. 발견된 두 건은 모두 INFO 수준의 사소한 문구 불일치(형제 DTO 간 `preview` JSDoc 표현 차이, 와이어 스펙 docblock의 "같은 틀" 표현이 실제 파일 구조 차이를 완전히 반영하지 않음)로, 이미 `--impl-prep` 단계 consistency-check 에서도 INFO 로 포착되어 의식적으로 수용된 사안이며 착수·병합을 막을 사유가 아니다.

## 위험도

LOW
