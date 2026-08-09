# 유지보수성(Maintainability) 리뷰 — auth-guard-reflection-hardening

## 리뷰 대상에 대한 전제

이번 diff 는 애플리케이션 소스 코드(`codebase/**`)가 아니라 `review/consistency/2026/08/09/15_09_04/` 하위에 신규 생성된 **consistency-checker 산출물 6개**(`convention_compliance.md`·`cross_spec.md`·`meta.json`·`naming_collision.md`·`plan_coherence.md`·`rationale_continuity.md`)뿐이다. 따라서 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 같은 코드 전용 관점은 실질적으로 적용 대상이 없고, 아래 발견사항은 가독성·네이밍(파일 구조)·일관성 관점에 집중했다.

## 발견사항

- **[WARNING]** `naming_collision.md` 에 sub-agent 호출 규약의 raw 헤더(STATUS 라인 + 마커)가 리포트 본문에 그대로 남아있음 — 형제 파일들과 형식 불일치
  - 위치: `review/consistency/2026/08/09/15_09_04/naming_collision.md:1-3`
  - 상세: 이 파일은 `STATUS=success naming_collision review complete — 0 critical, 0 warning, 2 info` 와 `===REPORT_MARKDOWN_BELOW===` 마커로 시작한 뒤 `# 신규 식별자 충돌 검토 …` 본문이 이어진다. 같은 세션에서 생성된 나머지 4개 리포트(`convention_compliance.md`·`cross_spec.md`·`plan_coherence.md`·`rationale_continuity.md`)는 전부 `#` 제목으로 곧바로 시작하며 이 헤더/마커가 없다. `STATUS=…`/`===REPORT_MARKDOWN_BELOW===` 는 sub-agent 가 orchestrator 에게 반환하는 **raw stdout 규약**(본 리뷰 자신도 따르는 계약)이지, 디스크에 영구 저장되는 리포트 문서의 형식이 아니다. 이 파일만 원본 stdout 이 그대로 write 된 것으로 보이며, harness 의 저장 경로에 checker 별로 다른 처리가 있음을 시사한다. 이 디렉터리의 `*.md` 를 "`#` 제목으로 시작하는 순수 리포트"로 가정해 파싱·집계하는 후속 도구(예: SUMMARY 생성기, 상위 orchestrator 의 blocked 판정)가 있다면 이 파일에서 조용히 오동작할 수 있다.
  - 제안: `naming_collision.md` 에서 1~4번째 줄(STATUS 라인 + 빈 줄 + 마커 + 빈 줄)을 제거해 `#` 제목부터 시작하도록 정정. 근본 원인(어느 저장 경로가 이 checker 결과만 raw stdout 그대로 write 하는지)은 harness 쪽에서 별도 확인 권고.

- **[INFO]** `naming_collision.md` 의 `## 위험도` 섹션이 형제 파일들과 다른 줄바꿈 규칙을 씀
  - 위치: `review/consistency/2026/08/09/15_09_04/naming_collision.md:38-39`
  - 상세: 이 파일은 `## 위험도` 바로 다음 줄에 `NONE` 값이 온다(빈 줄 없음). 반면 `convention_compliance.md:34-36`, `cross_spec.md`, `plan_coherence.md`, `rationale_continuity.md` 는 모두 `## 위험도` → 빈 줄 → 값의 3줄 패턴을 따른다. 위 WARNING 항목과 같은 저장 경로 차이에서 비롯됐을 가능성이 있다.
  - 제안: 빈 줄 삽입으로 형식 통일. 차단 사유는 아님.

- **[INFO]** 리포트 산문의 "상세" 항목이 과도하게 긴 단일 문단으로 작성돼 가독성이 낮음
  - 위치: `review/consistency/2026/08/09/15_09_04/convention_compliance.md:12` (WARNING 상세), `review/consistency/2026/08/09/15_09_04/cross_spec.md:12` (WARNING 상세) — 같은 패턴이 여러 파일에 반복
  - 상세: 예컨대 `convention_compliance.md:12` 는 대시(—)·괄호 중첩·복수 절 연결로 이어진 하나의 초장문 문단이다(수백 자, 5개 이상의 독립 주장을 한 문장/문단에 압축). 사람이 한 번에 읽고 핵심 근거를 추출하기 어렵다.
  - 제안: 향후 이런 자동 생성 리포트의 "상세" 항목은 문장 2~3개 단위로 쪼개거나 하위 bullet 로 분리하는 편이 재검토·인용 시 가독성이 좋다. 차단 사유 아님, 스타일 권고.

## 요약

이번 리뷰 대상은 애플리케이션 코드가 아니라 consistency-checker 가 생성한 리뷰 산출물 6개(markdown 5건 + meta.json 1건)이며, 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 등 코드 전용 유지보수성 기준은 적용할 대상이 없다. 문서 구조 관점에서는 `naming_collision.md` 한 파일만 sub-agent 호출 규약의 raw STATUS/마커 헤더가 본문에 그대로 남아 형제 파일들과 형식이 어긋나 있다는 점이 유일한 실질 지적(WARNING)이며, 이는 콘텐츠 오류라기보다 이 checker 저장 경로에서만 stdout 을 그대로 write 한 harness 상 불일치로 보인다. 같은 파일의 `## 위험도` 줄바꿈 차이(INFO)도 동일 원인일 가능성이 있다. 그 외 여러 리포트에서 반복되는 초장문 "상세" 문단은 가독성 개선 여지가 있으나(INFO), 리포트 내용 자체의 정확성이나 판단에는 영향이 없다. 전체적으로 차단 사유는 없다.

## 위험도

LOW
