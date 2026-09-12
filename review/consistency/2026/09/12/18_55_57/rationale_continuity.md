# Rationale 연속성 검토 — `plan/in-progress/spec-draft-chat-channel-doc-batch.md`

## 발견사항

- **[WARNING] item 1 의 glob 변경이 R-CC-22 본문의 리터럴 인용과 어긋나게 된다**
  - target 위치: target 문서 `## 1. \`15-chat-channel.md\` \`code:\` glob 이 \`dto/responses/\` 를
    못 잡는다` — `dto/chat-channel-*.dto.ts` → `dto/**/chat-channel-*.dto.ts` 변경안
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` `## Rationale` 의
    **R-CC-22**(`triggers/` 안의 chat-channel 구현 경로를 `code:` 에서 glob 으로 잡는다).
    R-CC-22 본문은 *"frontmatter `code:` 의 `modules/triggers/` 항목을 명시 파일 나열에서
    **좁은 glob 3개**로 바꾼다 — `chat-channel-*.ts` · `dto/chat-channel-*.dto.ts` ·
    `trigger-callback-url*.ts`"* 라고 **세 glob 문자열을 그대로 인용**해 결정을 기록했다.
  - 상세: target item 1 은 frontmatter 의 두 번째 glob(`dto/chat-channel-*.dto.ts`)을
    `dto/**/chat-channel-*.dto.ts` 로 대체한다. 새 glob 자체는 근거(정본 매처 실측표)가
    충실하고 R-CC-22 의 "통짜 대신 좁은 glob" 원칙과 상충하지 않는다 — **재도입도 원칙
    위반도 아니다.** 다만 R-CC-22 는 그 결정을 **frontmatter 리터럴 문자열 인용**으로
    기록해 뒀는데, target 은 frontmatter 만 고치고 R-CC-22 본문의 그 인용문은 그대로
    둔다. 병합되면 R-CC-22 를 읽는 다음 사람은 *"현재 glob 은 `dto/chat-channel-*.dto.ts`"*
    라고 믿게 되지만 실제 frontmatter 는 `dto/**/chat-channel-*.dto.ts` 다 — **R-CC-22
    자신이 R-CC-22 가 경계하는 "stale glob" 문제의 축소판을 만든다.** 이 문서는 이미
    같은 상황(R-CC-10·R-CC-21·§1.1.2)에서 `> **(YYYY-MM-DD 갱신/확장 — …)**` 인라인
    캐비엇으로 과거 Rationale 본문의 리터럴을 갱신해 온 선례가 있다(예: R-CC-10 의
    "2026-09-10 확장", §1.1.2 의 "2026-09-12 갱신").
  - 제안: target 에 R-CC-22 항목 하단에 짧은 갱신 캐비엇을 추가한다. 예:
    `> **(2026-09-12 확장)** 두 번째 glob 이 \`dto/**/chat-channel-*.dto.ts\` 로 넓어졌다 —
    \`swagger.md §5-1\` 이 응답 DTO 자리로 정한 \`dto/responses/\` 하위를 \`*\` 가 못 넘어
    (\`#1326\`) 덮지 못했다. 측정: [§1](#) 표.` 같은 한 문단이면 충분하다. item 1 의
    변경안 diff 자체에는 별도 수정이 필요 없다(frontmatter 코멘트는 이미 근거를 적었다).

## 요약

배치 7건 중 6건(§1~2, 3, 5~9)은 기존 Rationale 을 정확히 인용하고, 기각된 대안을 재도입하지
않으며(R-CC-10/R-CC-21/R-CC-22/R-CC-23 의 축·범위 구분을 침해하지 않음), 새 결정에는 실측·기각
대안·재검토 신호를 갖춘 신규 Rationale(문서 하단 "이 배치의 판단 3가지" + R-CC-22 확장 근거를
인라인 코멘트로 병기)을 동반한다. 특히 §7(`3-error-handling.md`)의 카탈로그 등재는 기존
도메인-참조 패턴(§1.5~§1.11)을 그대로 따르고, §8 의 번호 재정렬 기각은 `#970` 선례의 "유한한
문제를 무한한 문제와 바꾸지 않는다" 원칙을 정확히 계승한다. §4 의 네 번째 `code` 의미 추가는
기존 §1.1.2 세 갈래 표를 대체가 아니라 확장하며 R-CC-23(원인 기반 분류) 및 이미 구현된
`ENOTFOUND` 캐너리와 정합한다. 유일한 흠은 item 1 의 glob 변경이 R-CC-22 가 자신의 결정을
frontmatter 리터럴 인용으로 고정해 둔 방식과 충돌해 **Rationale 본문 자체가 stale 해지는
경미한 drift**를 만든다는 점이다 — 이는 새 원칙의 도입이나 과거 결정의 실질적 번복이 아니라
"인접 서술 갱신 누락"에 해당하며, 위 제안대로 한 문단만 추가하면 해소된다.

## 위험도
LOW
