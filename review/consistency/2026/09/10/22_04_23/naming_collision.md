# 신규 식별자 충돌 검토 — spec-draft-telegram-signing-carveout

## 검토 요약

target 문서(`plan/in-progress/spec-draft-telegram-signing-carveout.md`)는 **새 식별자를 거의
도입하지 않는다** — 어제 커밋(`df1962e25`)이 산문·미러 문서에 남긴 blanket 서술
(*"어떤 비밀도 쓰지 않는다"*)을 telegram 축 한정으로 **좁히는** 변경안(A~G)이며, 재사용하는
식별자(`R-CC-21`, `R-12`, `CCH-AD-02`, `botTokenRef`, `inboundSigningRef`,
`issuedInboundSigning`, `inboundSigningPlaintext`)는 모두 기존 spec 본문에서 실제로 같은 의미로
이미 정의돼 있음을 `spec/5-system/15-chat-channel.md`, `spec/2-navigation/2-trigger-list.md`,
`spec/data-flow/14-chat-channel.md`, `spec/4-nodes/7-trigger/providers/telegram.md` 원문 대조로
확인했다.

## 발견사항

### [INFO] R-CC-21 rationale 안에 동일 제목 "#### 기각한 대안" 서브섹션이 중복 배치된다

- target 신규 식별자: 변경안 **B** — `15-chat-channel.md` `### R-CC-21` 안에 **「telegram 은 왜
  예외인가」 소절 + 「기각한 대안」** 신설
- 기존 사용처: `spec/5-system/15-chat-channel.md:767` — 같은 `R-CC-21` 항목 안에 이미
  `#### 기각한 대안` H4 헤딩이 존재 (bot-token PATCH 우회에 대한 두 개의 기각 대안: *"optional 로
  두고 무시"*, *"`SecretResolver.rotate` 에 빈 값 가드"*)
- 상세: 저장소 전반에 "기각한 대안" 이라는 제목은 한 파일 안에서도 여러 번 재사용되는 확립된
  관례다(예: `spec/1-data-model.md` 4회, `spec/conventions/raw-query-results.md` 3회, `2-trigger-list.md`
  §R-2 rationale 안 별도 용례 등) — 그 자체는 이 저장소에서 위반이 아니다. 다만 기존 용례들은
  서로 다른 요구사항 ID(R-1/R-2/R-N…) 아래 분리돼 있어 직전 헤딩이 문맥을 구분해 준다. 여기서는
  **같은 R-CC-21 rationale 블록 안에, 바로 인접해서** 두 번째 "기각한 대안" H4 가 생기므로
  GitHub 스타일 앵커 생성 규칙상 두 번째는 `#기각한-대안-1` 로 자동 접미될 것이다. 현재
  `spec/`·`plan/` 어디에도 `15-chat-channel.md#기각한-대안` 형태로 이 특정 앵커를 가리키는 링크는
  없음을 확인했다(grep 0건) — 즉 **당장 깨지는 링크는 없다.** 다만 이 rationale 항목이 이제
  "bot-token 우회" 대안 목록과 "telegram carve-out" 대안 목록 두 개를 동일 제목으로 나란히 갖게
  되어, 향후 이 항목을 인용하는 링크나 사람이 어느 쪽을 가리키는지 헷갈릴 여지가 생긴다.
- 제안: 새로 추가하는 소절 제목을 `#### 기각한 대안 (telegram carve-out)` 처럼 구분되게 붙이거나,
  두 목록을 하나의 `#### 기각한 대안` 아래 하위 불릿(우회 처방 관련 / carve-out 관련)으로 합쳐
  헤딩 중복 자체를 피하는 편이 이후 인용을 명확하게 한다. 차단 사유는 아님.

## 확인했으나 충돌이 아닌 것들 (근거 포함)

- **요구사항 ID**: 신규 ID 부여 없음. `R-CC-21`(`15-chat-channel.md:734`), `R-12`
  (`2-trigger-list.md:333`), `CCH-AD-02`(`15-chat-channel.md:54`, *"Trigger enable / 신규 생성 시
  … 필수"*)는 모두 target 이 서술하는 스코프와 원문이 정확히 일치 — 재정의가 아니라 인용/전방
  참조다.
- **엔티티/타입명**: 신규 DTO·인터페이스명 도입 없음. target 은 오히려 `ChatChannelPatchConfigDto`
  명명을 **이 턴에서 다루지 않는다**고 명시하며, 저장소에 `Patch` 접두 클래스가 0건(`Create`/`Update`
  축)이라는 근거로 구현 턴에서 `ChatChannelUpdateConfigDto` 로 갈 것을 이미 결정해 뒀다 — 이
  checker 관점의 잠재 충돌도 자체적으로 이미 처리됨.
- **API endpoint**: 신규 endpoint 없음. `15-chat-channel.md:403` 의 v2 후보 (A) *"`POST
  /api/triggers/:id/chat-channel/rotate-inbound-signing` 신설"* 과 target 의 "기각한 대안" 표에
  등장하는 동일 이름의 API 제안은 **같은 v2 후보를 재인용**한 것으로, 이름이 겹치는 것이 아니라
  같은 미래 후보를 일관되게 지칭한다.
- **이벤트/메시지명**: 신규 webhook/queue/SSE 이벤트명 없음.
- **환경변수·설정키**: 신규 ENV/config key 없음. `issuedInboundSigning`(어댑터 반환값),
  `inboundSigningRef`/`botTokenRef`(config JSONB ref), `inboundSigningPlaintext`(입력 전용 필드)는
  모두 `spec/5-system/15-chat-channel.md` §4.1 데이터 모델과 `providers/telegram.md:219` 에 이미
  정의된 기존 키이며 target 은 그 스코프 서술만 좁힌다.
- **파일 경로**: target 이 새로 만드는 spec 파일은 없음(기존 파일 4곳의 본문 수정 + plan 문서 1곳
  본문 수정). plan 파일명 `spec-draft-telegram-signing-carveout.md` 도 기존
  `plan/complete/spec-sync-telegram-gaps.md`, `plan/complete/spec-edit-carveout.md` 와 글자만
  일부 겹칠 뿐 동일/근접 명명 충돌은 없음.
- **plan 결정 라벨**: target 은 `## 결정`에서 **D-A / D-B / D-C** 라벨을 새로 쓴다. 같은 체인의
  선행 plan(`plan/complete/spec-draft-chat-channel-patch-token.md`, 현재
  `plan/in-progress/spec-draft-nullable-notation-followups.md:1949,1958,2037,2042` 에서
  인용됨)은 이미 **D-1 / D-2 / D-3** 라벨을 다른 의미로 확정해 사용 중이다. `D-A/D-B/D-C`
  vs `D-1/D-2/D-3` 는 문자 체계가 달라 실제 충돌은 없음을 grep(0건 교차 사용)으로 확인했다 —
  오히려 선행 라벨과 겹치지 않도록 의식적으로 다른 체계를 쓴 것으로 보인다.

## 요약

target 문서는 실질적으로 새 식별자를 도입하지 않고, 기존 확정 식별자(R-CC-21 / R-12 / CCH-AD-02
/ botTokenRef / inboundSigningRef / issuedInboundSigning)의 스코프를 telegram 축 한정으로 좁히는
정정 turn이다. 6개 관점 전수 대조 결과 CRITICAL·WARNING 급 충돌은 없고, R-CC-21 안에 "기각한
대안" H4 제목이 중복 배치되는 것만 INFO 수준의 명명 명확화 제안으로 남긴다.

## 위험도

NONE
