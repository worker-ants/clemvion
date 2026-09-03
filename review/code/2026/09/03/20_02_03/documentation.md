# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[WARNING]** `invitedBy` nullable 전환이 OpenAPI 계약을 바꾸는데 CHANGELOG 항목이 없다 — 같은 plan 의 직전 커밋이 세운 자기 규칙을 이번 커밋만 어겼다
  - 위치: `CHANGELOG.md` (이 diff 에 파일 자체가 없음 — 부재가 결함). 대조 대상 커밋: `af1651264`(main 머지본 `562d3119f`)의 `CHANGELOG.md` 상단 `## Unreleased — AuthConfig.ipWhitelist ...` 항목
  - 상세: `AuthConfigDto.ipWhitelist` 를 nullable 로 정정한 직전 커밋(`af1651264`)은 커밋 메시지에서 명시적으로 규칙을 세웠다 — *"동작 변경 없음. OpenAPI 계약이 바뀌므로 CHANGELOG 항목을 달았다 — 최근 30머지 중 CHANGELOG 를 건드린 7건이 전부 관측 가능한 변경이었고, 배치 1·2 는 순수 내부 타입이라 생략이 옳았다."* 그리고 실제로 `CHANGELOG.md` 최상단에 종전/지금 표까지 포함한 전체 항목을 추가했다.
    이번 리뷰 대상 커밋(`9c120e6ae`, `fix(api): 초대자가 삭제되면 invitedBy 가 null 인데 Swagger 는 필수 uuid 라고 했다`)은 **같은 형태의 변경**이다 — `WorkspaceInvitationDto.invitedBy` 를 `@ApiProperty({ format: 'uuid' })`(필수·non-null)에서 `@ApiPropertyOptional({ format: 'uuid', nullable: true })`(nullable)로 바꿔 OpenAPI 로 코드를 생성하는 클라이언트가 영향을 받는다. 그런데 이 커밋의 변경 파일 목록(`git show 9c120e6ae --stat`)에 `CHANGELOG.md` 가 없고, 실제로 `grep -n "invitedBy" CHANGELOG.md` 결과도 0건이다.
    직전 커밋이 세운 판단 기준("OpenAPI 계약이 바뀌면 단다")을 그대로 적용하면 이번 변경도 대상이어야 하는데 빠졌다 — 자기모순이다.
  - 제안: `ipWhitelist` 항목과 같은 형식(종전/지금 DTO·Swagger 표, 영향 문단)으로 `CHANGELOG.md` 상단에 `invitedBy` 항목을 추가한다.

- **[WARNING]** plan 문서 안에 같은 "48건" 축에 대해 서로 모순되는 두 결론이 공존한다 — 오래된 절이 갱신되지 않았다
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:195-231`(이번 diff 로 수정된 체크리스트 항목, `[x]` **종결** 선언·"48건은 계측 도구의 산물, 실제 결함 1건") vs `plan/in-progress/entity-nullable-column-type-mismatch.md:333-359`(이번 diff 가 건드리지 않은 `### 새로 드러난 축` 절 — 여전히 `⚠️ 이 48 은 아직 작업 항목이 아니다`(:353), `이 축에는 가드가 없다`(:356) 라고 말하며 "엔티티별 귀속을 먼저 해야 수가 확정된다"는 미해결 서술을 유지)
  - 상세: 이전 버전(diff 의 `-` 라인)에서는 체크리스트 항목이 `> 상세·측정·판단 근거는 §배치 3 「새로 드러난 축」` 이라는 문장으로 §333 절을 가리키고 있었다. 이번 diff 는 그 화살표 문장을 지우고 체크리스트 항목 자체에 완전히 새로운 결론(48은 계측 오류, 실결함 1건, 가드를 만들지 않는 근거)을 채워 넣었다 — 그런데 원래 가리키던 §333 「새로 드러난 축」 절은 그대로 남아 옛 결론("48건이 잔여 작업 항목", "가드가 없다"는 사실만 적고 왜 안 만드는지는 언급 없음)을 계속 서술한다.
    `complete/` 로 이동하기 전 이 plan 을 처음부터 읽는 사람은 §333 절을 먼저 만나 "48건이 아직 열려 있고 엔티티별 귀속이 필요하다"고 오독할 수 있다 — 실제로는 체크리스트가 이미 그 결론을 반증하고 종결시켰다. 이 저장소가 반복적으로 겪은 "plan 서술이 철회로 거짓이 되는데 다른 절이 동기화 안 됨" 클래스와 같은 형태다.
  - 제안: §333 「새로 드러난 축」 절 도입부(또는 :353·:356 문장)에 "이 절의 판단은 갱신됨 — §할 일 체크리스트(:195) 참조, 48건은 계측 도구 산물로 반증됨" 취지의 짧은 전방/후방 포인터를 추가하거나, 이 절 자체를 체크리스트 항목의 결론으로 대체·요약해 중복 서술을 제거한다.

## 요약

핵심 코드 변경(`WorkspaceInvitationDto.invitedBy` nullable 전환)의 문서화 자체는 우수하다 — JSDoc 이 `ON DELETE SET NULL`(V017:15)·대기 초대 잔존·§5.4 규약 형태를 정확히 설명하고, `nest-cli.json` 의 `introspectComments: true` 덕분에 그 JSDoc 이 실제 Swagger 문서에도 반영되며, 새 테스트의 독스트링도 "고정하는 것은 통과 동작"이라는 근거를 명확히 남겨 뮤테이션 검증까지 기록했다. `workspaces.controller.ts:402`·`frontend/src/lib/api/workspaces.ts:154`·`V017:15` 등 plan 이 인용한 모든 위치·근거를 직접 열어 대조했고 전부 정확했다. 다만 두 가지 프로세스성 문서 갭이 있다 — (1) 같은 plan 의 직전 커밋이 스스로 세운 "OpenAPI 계약 변경 시 CHANGELOG 필수" 규칙을 이번 커밋만 따르지 않았고, (2) plan 문서 내부에 같은 주제(48건 축)를 다루는 신·구 두 절이 서로 모순된 결론을 담은 채 공존한다. 둘 다 코드 정확성과는 무관하지만, 다음 사람이 CHANGELOG 나 plan 절 중 한쪽만 읽으면 오판할 수 있는 자리라 WARNING 으로 기록한다.

## 위험도

LOW
