# RESOLUTION — 15_24_14

**CRITICAL 0 · WARNING 2.** 둘 다 이 세션이 **리뷰 결과를 받은 뒤 같은 턴에** 조치했다.
`codebase/**` 변경은 이 PR 에 **0건**이다(인프라 설정 + plan 문서).

## 조치 항목

| SUMMARY # | 분류 | 조치 | 비고 |
|---|---|---|---|
| #1 | 인프라 (완결성) | **세 번째 위치를 고쳤다** — `k8s/overlays/local/infra-minio.yaml` 의 `minio/minio`·`minio/mc` 를 `quay.io/*` 로. 내가 plan 에 *"한쪽만 고치면 다음 사람이 다시 진단한다"* 라고 써 놓고 한 파일을 빠뜨렸다. `kubectl kustomize k8s/overlays/local` 로 빌드 결과에 두 이미지가 quay 경로로 나오는 것을 확인했다 |
| #2 | 문서 (SoT drift) | **트래커를 닫았다** — `spec-sync-external-interaction-api-gaps.md` 의 *"처분 후보 (사용자 결정 필요)"* 문단을 취소선 처리하고 *"(a) 실행됨 → `e2e-minio-registry.md`"* + *"(b)·(c) 는 재검토 불요"* 를 달았다. 역방향 링크도 이 PR 의 plan 에 남겼다 |

## 두 reviewer 가 같은 파일을 다르게 등급 매긴 건 (기록)

`documentation` 은 *"어떤 Makefile/CI 도 그 오버레이를 참조하지 않으니 INFO"*, `dependency` 는
*"완결성 원칙 위반이니 WARNING"* 으로 갈렸다. **둘 다 맞다** — 즉시 장애는 아니고(참조 0건,
직접 확인), 다음 사람이 같은 진단을 반복하게 만든다. 그래서 **고치되 축은 좁혔다**:

- **레지스트리만** 바꿨다. 그 파일의 `:latest` → RELEASE 고정은 **버전 고정 축**(W-59)이라
  한 diff 에 섞지 않고 plan 의 §후속 등재로 옮겼다. `dependency` INFO 1(다이제스트 고정)도
  같은 축이라 같은 자리에 묶었다.

## 이월 (INFO — 조치 불요)

- **digest(`@sha256:`) 고정 미비** — 이번 diff 가 만든 위험이 아니다(Hub 참조 때부터 태그-only).
  plan 에 두 이미지의 sha256 을 실측으로 남겨 뒀으므로 전환 비용은 낮다 → 후속 등재.
- **quay.io 도 제3자** — 같은 클래스 재발 가능성은 인지된 채 수용(GHCR 미러는 *"지금 필요 없다"*).
- **e2e 전용 시크릿 하드코딩** — diff 범위 밖 기존 상태, *"운영 금지"* 주석 존재.

## TEST

- `run-test.sh e2e` → **`status=PASS tests=305 passed`** (compose 변경 후, 이 워크트리)
- `docker compose -f docker-compose.e2e.yml pull minio createbuckets` → 둘 다 **Pulled**,
  image ID 가 Hub 캐시본과 **동일**(`6c83c74c8028…` · `0029bb25aef9…`)
- `kubectl kustomize k8s/overlays/local` → quay 경로 2건 확인 (#1 조치 후)
- `docker compose -f docker-compose.yml config` → dev compose resolve
