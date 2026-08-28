import { connection } from "next/server";
import { Reveal } from "@/components/motion/Reveal";
import { EventCard } from "@/components/sections/CardWithModal";
import { PageRibbon } from "@/components/layout/PageRibbon";
import { Container } from "@/components/ui/Container";
import { BookNowButton } from "@/components/booking/BookNowButton";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { buildMetadata } from "@/lib/seo";
import { loadEventsPageData } from "@/lib/siteContent";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  await connection();
  const { copy } = await loadEventsPageData();
  return buildMetadata({
    title: "Events",
    description: copy.hero.subtitle,
    path: "/events",
  });
}

export default async function EventsPage() {
  await connection();
  const { copy, upcoming, past } = await loadEventsPageData();

  return (
    <>
      <PageRibbon
        title={copy.hero.title}
        subtitle={copy.hero.subtitle}
        image={copy.hero.ribbonImage}
        imageAlt="Colour and celebration at Goko Hostel"
      />
      <section className="py-8">
        <Container>
          <div className="flex flex-wrap justify-center gap-2">
            {copy.hero.chips.map((c, i) => (
              <span
                key={`${c}-${i}`}
                className="rounded-full bg-brand-mist px-4 py-2 text-sm font-medium text-brand-green-dark"
              >
                {c}
              </span>
            ))}
          </div>
        </Container>
      </section>

      {upcoming.length === 0 ? (
      <section className="py-16 md:py-24">
        <Container>
          <SectionHeader title="Upcoming highlights" align="left" />
          <p className="mt-10 text-sm text-brand-green-dark/60">No upcoming events yet.</p>
        </Container>
      </section>
      ) : (
      <section className="py-16 md:py-24">
        <Container>
          <SectionHeader title="Upcoming highlights" align="left" />
          <p className="mt-3 text-base text-brand-green-dark/70">
            Click on any event to see details and promotional images
          </p>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            {upcoming.map((ev, i) => (
              <Reveal key={`${ev.title}-${i}`} delay={i * 0.04}>
                <EventCard ev={ev} />
              </Reveal>
            ))}
          </div>
        </Container>
      </section>
      )}

      <section className="relative py-16 md:py-24">
        <div className="goko-divider-fade mx-auto mb-12 max-w-4xl" aria-hidden />
        <Container>
          <SectionHeader title="Memories from past events" align="left" />
          {past.length === 0 ? (
            <p className="mt-10 text-sm text-brand-green-dark/60">No past events yet.</p>
          ) : (
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            {past.map((ev, i) => (
              <Reveal key={`${ev.title}-${i}`} delay={i * 0.04}>
                <EventCard ev={ev} />
              </Reveal>
            ))}
          </div>
          )}

          <div className="goko-border-gradient mx-auto mt-14 max-w-2xl rounded-3xl bg-brand-sand/60 p-8 text-center shadow-soft md:p-10">
            <h3 className="font-display text-xl font-bold text-brand-green-dark md:text-2xl">
              {copy.pastCta.title}
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-brand-green-dark/90 md:text-base">
              {copy.pastCta.body}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <ButtonLink href="/stay">View rooms</ButtonLink>
              <BookNowButton variant="ctaOutline">Book now</BookNowButton>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
