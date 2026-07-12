# 유지보수성(Maintainability) 리뷰

## 대상 요약
`embed-config.dto.ts` → `embed-config-response.dto.ts` 순수 파일명 rename(내용 무변경, `git mv`) + `hooks.controller.ts` import 경로 1줄 갱신 + `spec/7-channel-web-chat/4-security.md` frontmatter `code:` 경로 1줄 갱신 + 신규 plan 문서. `git diff --stat` 로 확인: DTO 파일은 rename(0 changed lines), controller 는 import 문 1줄만 변경.

### 발견사항

- **[INFO]** 네이밍 컨벤션 정합 — 개선
  - 위치: `codebase/backend/src/modules/hooks/dto/responses/embed-config-response.dto.ts` (rename), `codebase/backend/src/modules/hooks/hooks.controller.ts:37`
  - 상세: `spec/conventions/swagger.md §5-1` 은 응답 DTO 파일명을 `*-response.dto.ts` 로 규정한다. 기존 `embed-config.dto.ts` 는 동일 디렉토리의 `webhook-response.dto.ts` 와 패턴이 어긋나 있었는데(사전 결함, 다수 과거 consistency-check 에서 WARNING/INFO 로 반복 지적됨), 본 변경으로 정합화됐다. 클래스명 `EmbedConfigDto` 는 의도적으로 유지 — swagger.md §5-1 은 파일명만 규정하고 클래스명은 규정하지 않으며, 같은 모듈의 `WebhookInteractionDto`/`WebhookAcceptedDto` 등도 `*Dto` 네이밍이라 일관성이 유지된다. plan 문서(`plan/in-progress/embed-config-dto-rename.md`)에 이 판단 근거가 명시돼 있어 추적 가능하다.
  - 제안: 없음(개선 사항).

- **[INFO]** import 경로 갱신 누락 여부 — 확인됨, 문제 없음
  - 위치: 저장소 전역
  - 상세: `grep -rn "embed-config\.dto"`(구 경로) 로 코드베이스 전역을 확인한 결과 남은 참조는 전부 `plan/complete/**`·`review/**` 의 과거 이력 문서뿐이며, 살아있는 코드·spec 경로(`hooks.controller.ts`, `4-security.md` frontmatter)는 모두 신규 경로로 정확히 갱신됐다. 구 파일도 워킹 트리에 남아있지 않다(orphan 없음).
  - 제안: 없음.

- **[INFO]** `EMBED_CONFIG_CACHE_SEC` 매직 넘버 중복 — pre-existing, 본 diff 무관
  - 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts:187` (`` `public, max-age=${300} — ...` ``) vs 상단 상수 `EMBED_CONFIG_CACHE_SEC = 300`(:156) 및 실제 사용처 :198
  - 상세: `@ApiResponse` 데코레이터의 문서용 description 문자열에 `300` 리터럴이 하드코딩돼 있어, 상단에 이미 정의된 `EMBED_CONFIG_CACHE_SEC` 상수와 값이 별도로 유지된다(값 drift 위험 — 캐시 시간을 바꾸면 이 한 곳을 별도로 고쳐야 함). 다만 이 라인은 이번 diff 에서 변경된 부분이 아니라(diff 는 import 문 1줄만 수정) 순수 컨텍스트이므로 본 rename 작업의 책임 범위 밖이다.
  - 제안: 후속(별도) 작업에서 `` `public, max-age=${EMBED_CONFIG_CACHE_SEC} — ...` `` 로 상수 참조하도록 교체 권장. 본 diff 의 blocking 사유는 아님.

- **[INFO]** plan 문서 품질
  - 위치: `plan/in-progress/embed-config-dto-rename.md`
  - 상세: 배경·컨벤션 재확인·변경 범위·impl-prep 판단이 모두 명시적으로 기록돼 있어 추적성이 좋다. "본 PR 무관, 별도 처리" 문구는 원 발견(consistency-check)이 이 plan 자체와 무관한 이전 리뷰에서 나왔다는 의미로, 본 plan 이 그 후속 조치임이 문맥상 명확해 혼동 소지는 낮다.
  - 제안: 없음.

### 요약
이번 변경은 내용 변경 없는 순수 파일명 rename(DTO 클래스·필드·로직 전혀 무변경) + 그에 따른 import 경로 1줄, spec frontmatter 경로 1줄 동기화로, 유지보수성 관점에서 오히려 개선(파일명 컨벤션 정합화, `dto/responses/` 디렉토리 내 네이밍 일관성 확보)이다. 가독성·함수 길이·중첩·복잡도·중복 등 실질적 코드 구조에 영향을 주는 변경이 없고, 참조 무결성(import·spec `code:` 경로)도 grep 으로 전수 확인해 누락이 없음을 확인했다. 유일한 관찰 사항(캐시 시간 매직 넘버 중복)은 본 diff 가 건드리지 않은 기존 코드이며 별건 후속 과제로 남기면 충분하다.

### 위험도
NONE
