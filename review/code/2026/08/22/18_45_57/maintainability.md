# 유지보수성(Maintainability) 리뷰 — egress-masking-convention

## 범위에 대한 전제

이번 변경분은 `codebase/**` 소스 코드 수정이 **전혀 없다** — 전부 `plan/in-progress/**`(2), `review/consistency/**`(18개, 대부분 이전 `/consistency-check` 라운드의 산출물 스냅샷), `spec/**`(4, 신설 1 + 인입 포인터 3줄 추가)로 구성된 순수 문서 변경이다. 따라서 함수 길이·중첩 깊이·순환 복잡도 같은 코드 전용 관점은 적용 대상이 없고, 아래는 문서 구조·네이밍·표기 일관성·중복에 한정해 검토했다. `review/consistency/**` 산출물은 다른 세션이 생성한 리뷰 로그(읽기 전용 스냅샷)이므로 이번 리뷰 대상에서 실질적으로 제외했다.

## 발견사항

- **[WARNING]** 좌표계 표의 행(row) 번호를 본문 산문에서 "N행" 접미사 없이 맨숫자로 인용 — 문서 자신이 경계하는 것과 같은 종류의 오독 소지
  - 위치: `spec/conventions/egress-masking.md:60`(`2 와 4 는 둘 다 \`10\` 이지만...`), `:62`(`3 이 \`>=\` 이면서... 2 가 정확히 depth \`N\`...`), `:44`(`2·3 이 이 값을 참조`), `:52`(`` `5` 의 호출부 2곳 ``). 동일 패턴이 `plan/in-progress/spec-draft-egress-masking-convention.md:99`(`` `5` 의 호출부 2곳 ``), `:102`(`**2·4 는 값이 같고 의미가 다르다.**`)에도 그대로 미러됨.
  - 상세: 이 문서는 `## 1. 좌표계` 표 바로 아래 캐비엇(`egress-masking.md:50`, `"값" 열은 깊이 값이지 행 번호가 아니다`)에서 이미 "숫자가 값인지 행 번호인지" 오독을 명시적으로 경계한다. 이 경계 자체가 실제로 있었던 사건(consistency `18_14_45` rationale_continuity CRITICAL — 표의 "값" 열에 `= 1`이라고 적어 행-참조 표기가 리터럴 1로 오독됨)의 재발 방지책이다. 그런데 정작 §1.1 본문(60·62행)과 §1 본문(44·52행)은 행 번호를 가리킬 때 `1~3행`/`4행`/`5행`(40행)처럼 "행" 접미사를 붙이는 곳과, `2 와 4`/`3 이`/`2 가`/`5의`처럼 접미사 없이 맨숫자를 쓰는 곳이 혼재한다. 맨숫자 참조는 표에서 멀어질수록(특히 §1.1처럼 별도 소제목 아래, 표에서 두 문단 떨어진 위치) 문맥만으로 "행 번호"임을 판단해야 하는 부담을 독자에게 지운다 — 이 문서가 스스로 막으려 한 것과 같은 부류의 모호성이다. 두 라운드의 consistency-check(`18_14_45`→`18_27_11`)가 표의 "값" 열 리터럴 오독은 CRITICAL로 잡아 고쳤지만, 본문 산문 전반의 맨숫자-행-참조 관행 자체는 지적 대상이 아니었어서 그대로 남았다.
  - 제안: 표에서 두 문단 이상 떨어진 산문(특히 `## 1.1` 절)에서 행을 지칭할 때는 일관되게 "2행", "4행"처럼 접미사를 붙이거나, `표 2행·4행` 처럼 표를 명시한다. 최소한 `## 1.1` 첫 문장만이라도 "표의 2행과 4행은" 으로 바꾸면 이후 대명사적 참조의 모호성이 줄어든다. `plan/in-progress/spec-draft-egress-masking-convention.md` 는 완료 후 archive 로 이동하는 이력 문서이므로 우선순위는 spec 파일 쪽이 높다.

- **[INFO]** `plan/in-progress/spec-draft-egress-masking-convention.md` 와 `spec/conventions/egress-masking.md` 사이의 좌표계 표·Rationale이 사실상 동일 내용을 두 번 서술
  - 위치: `plan/in-progress/spec-draft-egress-masking-convention.md:86-119`(표·캐비엇) vs `spec/conventions/egress-masking.md:38-62`, 그리고 두 파일의 `## Rationale > 기각한 대안` 4개 불릿(`spec-draft-*.md:179-195` vs `egress-masking.md:102-107`)
  - 상세: 이 저장소의 plan→spec 라이프사이클 관행(CLAUDE.md, `.claude/docs/plan-lifecycle.md`)상 의도된 패턴이며 결함으로 보지는 않는다 — plan 문서는 의사결정 과정을, spec 문서는 최종 상태를 담는 서로 다른 SoT다. 다만 두 파일 모두 같은 5행 좌표계 표·같은 4개 기각 대안을 거의 문장 단위로 반복하고 있어, 향후 W4(`inputData` 마스킹 게이트 통합) 트리거가 실행돼 소비처 열이 바뀔 때 spec 쪽만 갱신되고 plan 쪽(이미 `[x]` 완료 표시된 이력 문서)은 stale 상태로 남을 수 있다. 두 문서 모두 이 staleness 트리거를 자체적으로 문서화하고 있어(`egress-masking.md:83`, `spec-draft-*.md:112-115`) 실질 위험은 낮다.
  - 제안: 조치 불요. plan 문서가 `plan/complete/`로 이동한 뒤에는 갱신 대상에서 자연히 제외되므로 현재 관행을 유지해도 무방하다.

## 요약

이번 변경은 애플리케이션 코드가 아닌 spec/plan 문서 신설·수정이라 전통적 코드 유지보수성 지표(함수 길이·중첩·매직넘버·복잡도)는 해당 사항이 없다. 신설 문서 `spec/conventions/egress-masking.md`는 형제 conventions 파일과 동일한 kebab-case 네이밍·frontmatter 스키마·`§Overview/본문/§Rationale` 3섹션 구조를 따르고, 마커 리터럴을 이름으로만 인용하는 자체 규율도 일관되게 지켜 가독성·구조 면에서 전반적으로 양호하다. 두 라운드의 `/consistency-check --spec`(`18_14_45`→`18_27_11`)에서 나온 WARNING 전부(WS 인입 포인터 누락, `code:` frontmatter 파일 목록, 순서 계약 범위 caveat, W4 상호 참조)가 최종본에 반영되어 있음을 직접 대조로 확인했다. 유일하게 남은 지적은 문서 자신이 경계하는 "행 번호 vs 값" 오독 방지 취지와 어긋나게, 표에서 떨어진 산문이 행 번호를 접미사 없이 맨숫자로 지칭하는 표기 비일관성(WARNING)이며, plan-spec 간 내용 중복은 프로젝트 관행상 의도된 패턴으로 판단해 INFO로 남긴다.

## 위험도

LOW
