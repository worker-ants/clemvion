# 유지보수성(Maintainability) Review — `99d3e9000` 델타 (직전 2라운드 NONE)

오케스트레이터가 요청한 3개 질문에 집중해 짧게 답한다. 억지 발견 없음.

## 1. `safeApiBase` JSDoc 자기정정 blockquote(197-199행) — 비대화인가, 정당한가

**형식(리뷰 히스토리를 JSDoc 에 인용하는 관행) 자체는 이 파일의 기존 컨벤션이라 새 문제가 아니다.**
같은 파일 `sseErrorDetail` JSDoc(`use-widget.ts:252-255`)이 이미 `(ai-review `10_02_22`
side_effect·requirement)` 를 인용하며 "첫 판은 `e.type` 만 남겼는데 죽은 필드였다" 는 같은 패턴을
쓴다. 그러니 "리뷰 라운드을 코드에 인용한다" 자체를 지적하면 이 파일 전체 컨벤션과 충돌한다.

다만 **이번 것은 내용의 성격이 다르다.** `sseErrorDetail` 의 인용은 "왜 코드가 이 모양인가"(readyState
를 쓰는 이유 — 되돌리려는 미래 시도를 막는 설계 근거)를 담아 코드 이해에 직접 기여한다. 반면
`safeApiBase` 의 blockquote(197-199)는 바로 위 문단(192-195)이 이미 서술한 "조용한 반환" 사실을
**되풀이**할 뿐, 그 자체로 코드 설계 정보를 추가하지 않는다 — "spec 은 고쳤는데 코드 JSDoc 은
안 고쳤었다" 는 **문서 동기화 사고의 이력**이다. 같은 문장(문구까지 거의 동일)이 이미
`spec/7-channel-web-chat/4-security.md:296-302`(§R7 Rationale, 이 저장소 컨벤션상 "결정의
근거" 의 지정 SoT) 와 `plan/complete/webchat-boot-apibase-scheme-validation.md:93`(side_effect
INFO 처분 기록)에도 있다 — 이번 추가로 **같은 한 사실이 4곳**(spec §R7·JSDoc blockquote·plan
완료노트·plan 리뷰라운드1 절)에 복제됐다.

- **[INFO]** `safeApiBase` JSDoc blockquote 가 spec §R7 Rationale 과 사실상 동일 문장을 반복
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:197-199`, 대조: `spec/7-channel-web-chat/4-security.md:296-302`
  - 상세: 위 설명대로 — 코드 설계 정보가 아니라 리뷰 이력 기록이 지정 SoT(spec Rationale) 밖에 4번째로 복제됨. 직전 라운드(`review/code/2026/08/11/15_32_44/maintainability.md`)가 이미 같은 클래스(boot JSDoc ↔ 테스트 JSDoc 중복)에 "교차 참조로 축약" 을 제안한 바 있다.
  - 제안: blockquote 본문을 "정정 이력은 `4-security.md` §R7 참고" 한 줄로 축약. blocking 은 아니다 — 새 결함이 아니라 정보 위치의 미세 비효율이고, 이 파일의 인용 관행 자체는 유지해도 된다.

## 2. 새 e2e 테스트 JSDoc(판별력 없던 첫 판 이력 포함) — 코드에 남을 값인가

**정당하다.** `use-widget-eager-start.test.ts:4243-4255` 의 JSDoc은 단순 이력이 아니라 **`trigger`
파라미터를 의도적으로 뺀 이유**를 설명한다 — 넣으면 같은 파일의 "host 없이 직접 로드" 폴백이 boot 과
무관하게 쿼리만으로 부팅해 버려 이 테스트가 다시 판별력을 잃는다. 이건 "왜 이 테스트가 이 모양인가"
를 코드로 설명하는 자리라 1번 항목과 성격이 다르다 — 없으면 다음 사람이 "완결성을 높이려고"
`trigger` 를 되돌려 넣어 같은 vacuous 결함을 재생산할 수 있다. 게다가 이 구체적 서사(어떤 뮤턴트가
왜 통과했는지)는 `review/code/.../15_32_44/RESOLUTION.md` 에만 있고 — 이 저장소 관행상
`review/**` 는 SoT 가 아니라 언제든 사라져도 되는 산출물이므로, 영구 기록으로 남을 곳은 테스트
JSDoc 뿐이다. 옮길 곳이 없다는 점에서 1번과 처분이 갈린다.

## 3. apiBase 관련 순수 헬퍼 — 별 모듈(`boot-config.ts`) 분리 시점인가

질문의 "넷" 은 소폭 정정이 필요하다 — `safeApiBaseFromQuery` 는 직전 라운드(`d8abc7003`)에서 이미
삭제됐다(`grep -rn safeApiBaseFromQuery codebase/` 0건, 확인함). 현재는 이름 있는 순수 함수
**`safeApiBase`/`configFromQuery`/`mergeBootConfig` 3개**(`use-widget.ts:166-247`, ~82줄 — 대부분
JSDoc)와, `useWidget()` 본문 안의 **인라인 호출 1곳**(`use-widget.ts:1377-1380`, "host 없이 직접
로드" 폴백 — 별도 이름의 헬퍼가 아니다)이다.

파일이 1425줄로 여전히 크고 이 클러스터가 계속 자라는 중(주로 JSDoc, 위 1번 참고)이라는 점에서
분리 후보라는 판단은 유효하지만, **지금 강제할 결함은 아니다** — 직전 라운드(`15_16_20`
maintainability INFO)의 결론과 같다: 실제 로직은 여전히 작고(각 함수 5~12줄), 분리해도 옮겨지는
것은 대부분 JSDoc 부피이지 설계 결함 해소가 아니다. 다음에 apiBase 관련 **네 번째 진짜 이름 있는
헬퍼**가 추가되는 시점을 트리거로 남겨두는 것으로 충분하다.

### 요약

새 결함 없음. `safeApiBase` JSDoc blockquote(197-199)는 이 파일의 기존 "리뷰 이력 인용" 관행 자체는
어기지 않지만, 내용상 spec §R7 Rationale과 거의 동일한 문장을 4번째로 복제해 정보가 아니라 잉여다
(INFO, 비차단). 반대로 새 e2e 테스트의 "판별력 없던 첫 판" JSDoc은 `trigger` 를 뺀 설계 이유를
설명하는 유일한 영구 기록이라 정당하다. apiBase 순수 헬퍼는 3개(+인라인 폴백 1곳)로, 파일이 크긴
하나 분리를 강제할 시점은 아직 아니다 — 이전 라운드 판단과 동일.

### 위험도

NONE

STATUS: OK
